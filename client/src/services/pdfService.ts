import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PdfGenerationOptions {
  fileName?: string;
  title?: string;
  subtitle?: string;
  company: string;
  footerText?: string;
}

export const generatePdfFromElement = async (
  element: HTMLElement, 
  options: PdfGenerationOptions
) => {
  const { 
    fileName = 'reporte-kpis', 
    title = 'Reporte de KPIs', 
    subtitle = 'Resumen de indicadores clave',
    company,
    footerText = '© DIGO KPIs - Econova'
  } = options;

  // Primero capturamos el elemento
  const canvas = await html2canvas(element, {
    scale: 2, // Mejor resolución
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/png');
  
  // Crear PDF con orientación apaisada (horizontal)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Calcular dimensiones manteniendo el aspect ratio
  const imgWidth = pageWidth - 20; // 10mm de margen a cada lado
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
  // Añadir encabezado
  pdf.setFillColor(39, 57, 73); // #273949 - Color principal de Econova
  pdf.rect(0, 0, pageWidth, 20, 'F');
  
  // Añadir título
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.text(title, 10, 10);
  
  // Añadir fecha
  const currentDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text(currentDate, pageWidth - 10, 10, { align: 'right' });
  
  // Añadir subtítulo
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(39, 57, 73); // #273949
  pdf.setFontSize(12);
  pdf.text(subtitle, 10, 25);
  
  // Añadir nombre de empresa
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(company, 10, 32);
  
  // Insertar la imagen del contenido capturado
  pdf.addImage(imgData, 'PNG', 10, 40, imgWidth, imgHeight);
  
  // Añadir pie de página
  const footerY = pageHeight - 10;
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(128, 128, 128); // Color gris
  pdf.setFontSize(8);
  pdf.text(footerText, pageWidth / 2, footerY, { align: 'center' });
  
  // Guardar PDF
  pdf.save(`${fileName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

export const generateAnalysisPdf = async (
  kpis: any[],
  companyName: string,
  period: string
) => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Encabezado
  pdf.setFillColor(39, 57, 73); // #273949 - Color principal de Econova
  pdf.rect(0, 0, pageWidth, 25, 'F');
  
  // Título
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.text('Análisis detallado de KPIs', 10, 15);
  
  // Fecha y período
  const currentDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  pdf.setFontSize(10);
  pdf.text(`Fecha: ${currentDate}`, pageWidth - 10, 10, { align: 'right' });
  pdf.text(`Período: ${period}`, pageWidth - 10, 15, { align: 'right' });
  
  // Nombre de empresa
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(39, 57, 73);
  pdf.setFontSize(14);
  pdf.text(companyName, 10, 35);
  
  // Introducción
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text('Este informe proporciona un análisis detallado de los KPIs de la empresa, destacando tendencias,', 10, 45);
  pdf.text('desviaciones y recomendaciones para mejorar el rendimiento.', 10, 51);
  
  let y = 65;
  
  // Análisis de KPIs
  kpis.forEach((kpi, index) => {
    // Verificar si necesitamos una nueva página
    if (y > pageHeight - 40) {
      pdf.addPage();
      y = 20;
    }
    
    // Título del KPI
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(39, 57, 73);
    pdf.text(`${index + 1}. ${kpi.name}`, 10, y);
    y += 8;
    
    // Valor actual
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Valor actual: ${kpi.value}`, 15, y);
    y += 6;
    
    // Meta
    pdf.text(`Meta: ${kpi.target}`, 15, y);
    y += 6;
    
    // Estado
    const isOnTarget = kpi.status === 'success';
    if (isOnTarget) {
      pdf.setTextColor(0, 128, 0); // Verde para éxito
    } else {
      pdf.setTextColor(200, 0, 0); // Rojo para alerta
    }
    pdf.text(`Estado: ${isOnTarget ? 'Dentro del objetivo' : 'Fuera del objetivo'}`, 15, y);
    pdf.setTextColor(39, 57, 73);
    y += 6;
    
    // Tendencia (análisis ficticio para demostración)
    let tendencia = '';
    if (kpi.trend === 'up') {
      tendencia = 'Positiva ↑';
    } else if (kpi.trend === 'down') {
      tendencia = 'Negativa ↓';
    } else {
      tendencia = 'Estable →';
    }
    
    pdf.text(`Tendencia: ${tendencia}`, 15, y);
    y += 6;
    
    // Análisis (esto podría venir de un análisis real en el futuro)
    pdf.setFontSize(10);
    pdf.text('Análisis:', 15, y);
    y += 5;
    
    const analysis = getAnalysisForKpi(kpi);
    
    // Múltiples líneas para el análisis
    const splitAnalysis = pdf.splitTextToSize(analysis, pageWidth - 30);
    pdf.text(splitAnalysis, 20, y);
    y += splitAnalysis.length * 6;
    
    // Recomendaciones
    pdf.text('Recomendaciones:', 15, y);
    y += 5;
    
    const recommendations = getRecommendationsForKpi(kpi);
    const splitRecommendations = pdf.splitTextToSize(recommendations, pageWidth - 30);
    pdf.text(splitRecommendations, 20, y);
    y += splitRecommendations.length * 6 + 10;
  });
  
  // Pie de página
  const footerY = pdf.internal.pageSize.getHeight() - 10;
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(128, 128, 128);
  pdf.setFontSize(8);
  pdf.text('© DIGO KPIs - Econova', pageWidth / 2, footerY, { align: 'center' });
  
  // Guardar PDF
  pdf.save(`analisis-kpis-${companyName.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};

// Función para generar análisis basado en el KPI
function getAnalysisForKpi(kpi: any): string {
  const isOnTarget = kpi.status === 'success';
  
  if (kpi.name.includes('Volumen de Ventas')) {
    return isOnTarget 
      ? `El volumen de ventas se mantiene dentro del objetivo establecido. La estrategia de ventas actual está generando resultados positivos y el equipo está cumpliendo con las expectativas.`
      : `El volumen de ventas está por debajo del objetivo establecido. Esto puede deberse a factores estacionales, una disminución en la demanda del mercado o problemas con la estrategia de ventas actual.`;
  }
  
  if (kpi.name.includes('Margen Bruto')) {
    return isOnTarget 
      ? `El margen bruto se mantiene saludable, lo que indica una buena estructura de costos y pricing adecuado para los productos. La empresa está generando un valor adecuado por cada venta realizada.`
      : `El margen bruto está por debajo del objetivo, lo que podría indicar un aumento en los costos de producción, presión competitiva sobre los precios o una mezcla de productos menos favorable.`;
  }
  
  if (kpi.name.includes('Rotación de Inventario')) {
    return isOnTarget 
      ? `La rotación de inventario está en un nivel óptimo, indicando un buen balance entre mantener stock suficiente y minimizar el capital inmovilizado.`
      : `La baja rotación de inventario sugiere que hay productos estancados o que se está manteniendo un nivel de stock demasiado alto, lo que aumenta los costos de almacenamiento y el riesgo de obsolescencia.`;
  }
  
  if (kpi.name.includes('Tiempo de Entrega')) {
    return isOnTarget 
      ? `Los tiempos de entrega están dentro de los objetivos, lo que refleja una cadena de suministro eficiente y procesos logísticos bien optimizados.`
      : `Los tiempos de entrega están por encima de lo esperado, lo que podría estar afectando la satisfacción del cliente y generando ineficiencias operativas.`;
  }
  
  if (kpi.name.includes('Devoluciones')) {
    return isOnTarget 
      ? `La tasa de devoluciones se mantiene bajo control, lo que indica una buena calidad de producto y satisfacción del cliente.`
      : `El aumento en las devoluciones podría estar señalando problemas de calidad, errores en envíos o discrepancias entre las expectativas del cliente y el producto entregado.`;
  }
  
  if (kpi.name.includes('Precisión en estados financieros')) {
    return isOnTarget 
      ? `La precisión en los estados financieros es alta, lo que refleja buenas prácticas contables y controles internos efectivos.`
      : `La precisión en los estados financieros está por debajo del objetivo, lo que podría indicar problemas en los procesos contables o en los sistemas de información.`;
  }
  
  if (kpi.name.includes('Rotación de cuentas por cobrar')) {
    // Para este KPI, valores más bajos son mejores
    const inversedIsOnTarget = !isOnTarget;
    return inversedIsOnTarget 
      ? `La rotación de cuentas por cobrar es adecuada, indicando una buena gestión de crédito y cobranza.`
      : `La alta rotación de cuentas por cobrar sugiere que los clientes están tardando demasiado en pagar, lo que podría estar afectando el flujo de caja.`;
  }
  
  // Análisis genérico para otros KPIs
  return isOnTarget 
    ? `El KPI se mantiene dentro del objetivo establecido, lo que indica un buen desempeño en esta área.`
    : `El KPI está fuera del objetivo, lo que podría requerir acciones correctivas o un análisis más profundo para identificar causas raíz.`;
}

// Función para generar recomendaciones basadas en el KPI
function getRecommendationsForKpi(kpi: any): string {
  const isOnTarget = kpi.status === 'success';
  
  if (kpi.name.includes('Volumen de Ventas')) {
    return isOnTarget 
      ? `Mantener la estrategia actual de ventas. Considerar análisis de productos con mejor desempeño para potenciar aún más los resultados.`
      : `Revisar la estrategia de ventas, capacitar al equipo en nuevas técnicas y evaluar la implementación de promociones estratégicas para impulsar el volumen.`;
  }
  
  if (kpi.name.includes('Margen Bruto')) {
    return isOnTarget 
      ? `Continuar monitoreando los costos y evaluar periódicamente la estrategia de precios para mantener o mejorar el margen.`
      : `Analizar la estructura de costos, renegociar con proveedores, evaluar el mix de productos y considerar ajustes en los precios donde sea posible.`;
  }
  
  if (kpi.name.includes('Rotación de Inventario')) {
    return isOnTarget 
      ? `Mantener las políticas actuales de inventario y continuar optimizando las previsiones de demanda.`
      : `Implementar políticas de gestión de inventario más agresivas, revisar las previsiones de demanda y considerar promociones para productos con baja rotación.`;
  }
  
  if (kpi.name.includes('Tiempo de Entrega')) {
    return isOnTarget 
      ? `Mantener los procesos actuales y considerar documentarlos como mejores prácticas para la organización.`
      : `Analizar los cuellos de botella en la cadena logística, evaluar proveedores de transporte alternativos y optimizar las rutas de entrega.`;
  }
  
  if (kpi.name.includes('Devoluciones')) {
    return isOnTarget 
      ? `Seguir monitoreando las razones de devolución para identificar tendencias y mantener la calidad.`
      : `Implementar un análisis detallado de las causas de devolución, mejorar el control de calidad y revisar la descripción de productos para alinear las expectativas de los clientes.`;
  }
  
  if (kpi.name.includes('Precisión en estados financieros')) {
    return isOnTarget 
      ? `Mantener los controles y procedimientos actuales, considerando la automatización de procesos para mayor eficiencia.`
      : `Revisar los procedimientos contables, implementar verificaciones adicionales y considerar capacitación adicional para el personal.`;
  }
  
  if (kpi.name.includes('Rotación de cuentas por cobrar')) {
    // Para este KPI, valores más bajos son mejores
    const inversedIsOnTarget = !isOnTarget;
    return inversedIsOnTarget 
      ? `Mantener las políticas de crédito actuales y continuar con las prácticas efectivas de cobranza.`
      : `Revisar las políticas de crédito, implementar un seguimiento más proactivo de las cuentas por cobrar y considerar incentivos para pagos anticipados.`;
  }
  
  // Recomendaciones genéricas para otros KPIs
  return isOnTarget 
    ? `Mantener las prácticas actuales y buscar oportunidades de mejora continua para optimizar aún más este indicador.`
    : `Analizar las causas raíz de la desviación, desarrollar un plan de acción específico y establecer revisiones periódicas para monitorear el progreso.`;
}