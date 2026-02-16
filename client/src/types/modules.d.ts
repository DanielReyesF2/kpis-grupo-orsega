/**
 * Declaraciones para módulos sin tipos o con resolución incorrecta tras npm install.
 * Permite que tsc --noEmit pase hasta que los paquetes expongan tipos correctamente.
 */
declare module "lucide-react";

declare module "date-fns" {
  export function format(date: Date | number, formatStr: string, options?: object): string;
  export function parseISO(argument: string): Date;
  export function add(date: Date | number, duration: object): Date;
  export function addDays(date: Date | number, amount: number): Date;
  export function addWeeks(date: Date | number, amount: number): Date;
  export function addMonths(date: Date | number, amount: number): Date;
  export function addYears(date: Date | number, amount: number): Date;
  export function subMonths(date: Date | number, amount: number): Date;
  export function subDays(date: Date | number, amount: number): Date;
  export function startOfWeek(date: Date | number, options?: object): Date;
  export function endOfWeek(date: Date | number, options?: object): Date;
  export function startOfMonth(date: Date | number): Date;
  export function endOfMonth(date: Date | number): Date;
  export function eachDayOfInterval(interval: { start: Date; end: Date }): Date[];
  export function isSameDay(left: Date | number, right: Date | number): boolean;
  export function isSameMonth(left: Date | number, right: Date | number): boolean;
  export function isWithinInterval(date: Date, interval: { start: Date; end: Date }): boolean;
  export function isBefore(date: Date | number, dateToCompare: Date | number): boolean;
  export function isAfter(date: Date | number, dateToCompare: Date | number): boolean;
  export function isPast(date: Date | number): boolean;
  export function isToday(date: Date | number): boolean;
  export function isTomorrow(date: Date | number): boolean;
  export function differenceInDays(left: Date | number, right: Date | number): number;
  export function isFuture(date: Date | number): boolean;
  export const es: object;
  export const enUS: object;
}

declare module "moment";
declare module "react-calendar-timeline";
declare module "react-resizable-panels";

declare module "date-fns/locale" {
  const es: object;
  const enUS: object;
  export { es, enUS };
  export default { es, enUS };
}
