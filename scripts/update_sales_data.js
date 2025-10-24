import { storage } from '../server/storage.js';

// Función para actualizar los datos del KPI de volumen de ventas
async function updateSalesData() {
  try {
    // Encontrar el KPI de volumen de ventas para Dura International
    const allKpis = await storage.getKpis();
    const duraVolumeKpi = allKpis.find(kpi => 
      kpi.name.includes("Volumen de ventas") && 
      kpi.companyId === 1 // Dura International
    );

    if (!duraVolumeKpi) {
      console.error("No se encontró el KPI de volumen de ventas para Dura International");
      return;
    }

    console.log(`Encontrado KPI: ${duraVolumeKpi.name} (ID: ${duraVolumeKpi.id})`);
    
    // Datos de ventas para 2023 de la tabla
    const sales2023 = [
      { month: "Enero", value: "52,193.50" },
      { month: "Febrero", value: "64,521.30" },
      { month: "Marzo", value: "46,251.50" },
      { month: "Abril", value: "47,495.51" },
      { month: "Mayo", value: "42,926.50" },
      { month: "Junio", value: "54,170.68" },
      { month: "Julio", value: "55,786.25" },
      { month: "Agosto", value: "80,506.12" },
      { month: "Septiembre", value: "46,855.00" },
      { month: "Octubre", value: "55,946.50" },
      { month: "Noviembre", value: "45,934.88" },
      { month: "Diciembre", value: "38,215.00" }
    ];

    // Datos de ventas para 2024 de la tabla
    const sales2024 = [
      { month: "Enero", value: "46,407.17" },
      { month: "Febrero", value: "54,955.17" },
      { month: "Marzo", value: "58,170.41" },
      { month: "Abril", value: "51,814.50" },
      { month: "Mayo", value: "56,757.88" },
      { month: "Junio", value: "45,015.50" },
      { month: "Julio", value: "67,090.00" },
      { month: "Agosto", value: "36,533.20" },
      { month: "Septiembre", value: "57,676.50" },
      { month: "Octubre", value: "70,538.00" },
      { month: "Noviembre", value: "40,676.04" },
      { month: "Diciembre", value: "54,120.30" }
    ];

    // Target mensual de ventas para Dura International
    const monthlyTarget = 53480;

    // Crear los valores de KPI para 2023
    for (const data of sales2023) {
      // Convertir el valor a número para cálculos (eliminar comas)
      const numericValue = parseFloat(data.value.replace(",", ""));
      
      // Calcular el porcentaje de cumplimiento
      const compliancePercentage = ((numericValue / monthlyTarget) * 100).toFixed(1);
      
      // Determinar el estado basado en el porcentaje de cumplimiento
      let status;
      if (compliancePercentage >= 100) {
        status = "complies";
      } else if (compliancePercentage >= 85) {
        status = "alert";
      } else {
        status = "not_compliant";
      }

      // Crear un comentario basado en el estado
      let comment = "";
      if (status === "complies") {
        comment = `Por encima del objetivo mensual de ${monthlyTarget} KG`;
      } else if (status === "alert") {
        comment = `Ligeramente por debajo del objetivo mensual de ${monthlyTarget} KG`;
      } else {
        comment = `Significativamente por debajo del objetivo mensual de ${monthlyTarget} KG`;
      }

      // Crear nuevo valor de KPI
      const kpiValue = {
        kpiId: duraVolumeKpi.id,
        value: `${data.value} KG`,
        period: `${data.month} 2023`,
        compliancePercentage: `${compliancePercentage}%`,
        status,
        comments: comment
      };

      await storage.createKpiValue(kpiValue);
      console.log(`Creado valor KPI para ${data.month} 2023: ${data.value} KG (${compliancePercentage}%)`);
    }

    // Crear los valores de KPI para 2024
    for (const data of sales2024) {
      // Convertir el valor a número para cálculos (eliminar comas)
      const numericValue = parseFloat(data.value.replace(",", ""));
      
      // Calcular el porcentaje de cumplimiento
      const compliancePercentage = ((numericValue / monthlyTarget) * 100).toFixed(1);
      
      // Determinar el estado basado en el porcentaje de cumplimiento
      let status;
      if (compliancePercentage >= 100) {
        status = "complies";
      } else if (compliancePercentage >= 85) {
        status = "alert";
      } else {
        status = "not_compliant";
      }

      // Crear un comentario basado en el estado
      let comment = "";
      if (status === "complies") {
        comment = `Por encima del objetivo mensual de ${monthlyTarget} KG`;
      } else if (status === "alert") {
        comment = `Ligeramente por debajo del objetivo mensual de ${monthlyTarget} KG`;
      } else {
        comment = `Significativamente por debajo del objetivo mensual de ${monthlyTarget} KG`;
      }

      // Crear nuevo valor de KPI
      const kpiValue = {
        kpiId: duraVolumeKpi.id,
        value: `${data.value} KG`,
        period: `${data.month} 2024`,
        compliancePercentage: `${compliancePercentage}%`,
        status,
        comments: comment
      };

      await storage.createKpiValue(kpiValue);
      console.log(`Creado valor KPI para ${data.month} 2024: ${data.value} KG (${compliancePercentage}%)`);
    }

    console.log("Actualización de datos completada exitosamente");
  } catch (error) {
    console.error("Error al actualizar los datos de ventas:", error);
  }
}

// Ejecutar la función
updateSalesData().then(() => {
  console.log("Proceso finalizado");
}).catch(err => {
  console.error("Error en el proceso:", err);
});