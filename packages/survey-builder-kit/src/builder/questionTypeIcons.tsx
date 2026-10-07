import ShortTextIcon from '@mui/icons-material/ShortText';
import NotesIcon from '@mui/icons-material/Notes';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import StarRateIcon from '@mui/icons-material/StarRate';
import SpeedIcon from '@mui/icons-material/Speed';
import NumbersIcon from '@mui/icons-material/Numbers';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import TitleIcon from '@mui/icons-material/Title';
import type { QuestionType } from '../types/survey';

export const QUESTION_TYPE_ICONS: Record<QuestionType, typeof ShortTextIcon> = {
  shortText: ShortTextIcon,
  longText: NotesIcon,
  singleChoice: RadioButtonCheckedIcon,
  multipleChoice: CheckBoxIcon,
  rating: StarRateIcon,
  nps: SpeedIcon,
  number: NumbersIcon,
  boolean: ToggleOnIcon,
  date: CalendarTodayIcon,
  label: TitleIcon,
};
