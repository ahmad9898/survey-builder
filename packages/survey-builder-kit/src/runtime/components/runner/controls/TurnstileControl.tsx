import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { loadTurnstileScript } from '../turnstileLoader';
import type { QuestionControlProps } from './types';

export function TurnstileControl({ question, value, onChange }: QuestionControlProps) {
  const siteKey = question.turnstileSiteKey;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const alreadyVerified = typeof value === 'string' && value.length > 0;

  useEffect(() => {
    // Already has a token (e.g. the host supplied one directly via
    // predefinedAnswers, or this control is remounting after the
    // respondent went back and forward again without it expiring) --
    // nothing to render, so don't load the script or touch the widget at
    // all. See the component's own "already verified" render branch below.
    if (alreadyVerified) return;
    if (!siteKey) {
      setLoadError('Turnstile site key not configured.');
      return;
    }

    let cancelled = false;
    setLoadError(null);
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onChange(token),
          // Both put the respondent back to square one -- clearing the
          // value re-blocks Continue (questionValidation.ts's
          // canAttemptAdvance requires a non-empty string).
          'expired-callback': () => onChange(undefined),
          'error-callback': () => onChange(undefined),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load the verification widget.');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, alreadyVerified]);

  if (alreadyVerified) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
        <CheckCircleIcon fontSize="small" />
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>Verified</Typography>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Typography role="alert" sx={{ color: 'error.main', fontSize: 14.5 }}>
        {loadError}
      </Typography>
    );
  }

  return <Box ref={containerRef} />;
}
