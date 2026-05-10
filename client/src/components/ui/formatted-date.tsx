import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FormattedDateProps {
  date: Date;
  showTime?: boolean;
  /** Interpretar como fecha UTC (para fechas de negocio almacenadas como midnight UTC) */
  utc?: boolean;
}

export function FormattedDate({ date, showTime = false, utc = false }: FormattedDateProps) {
  if (!date) return null;

  try {
    const formatStr = showTime
      ? "d 'de' MMMM, yyyy 'a las' HH:mm"
      : "d 'de' MMMM, yyyy";

    // Para fechas de negocio (departure, delivery) almacenadas como midnight UTC:
    // ajustar por timezone offset para que date-fns muestre el día correcto.
    const displayDate = utc
      ? new Date(date.getTime() + date.getTimezoneOffset() * 60000)
      : new Date(date);

    return <span>{format(displayDate, formatStr, { locale: es })}</span>;
  } catch (error) {
    console.error("Error formatting date:", error);
    return <span>{date.toString()}</span>;
  }
}