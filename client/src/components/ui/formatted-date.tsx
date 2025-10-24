import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FormattedDateProps {
  date: Date;
  showTime?: boolean;
}

export function FormattedDate({ date, showTime = false }: FormattedDateProps) {
  if (!date) return null;
  
  try {
    const formatStr = showTime 
      ? "d 'de' MMMM, yyyy 'a las' HH:mm"
      : "d 'de' MMMM, yyyy";
    
    return <span>{format(new Date(date), formatStr, { locale: es })}</span>;
  } catch (error) {
    console.error("Error formatting date:", error);
    return <span>{date.toString()}</span>;
  }
}