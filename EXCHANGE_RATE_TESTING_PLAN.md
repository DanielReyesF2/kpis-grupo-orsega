# 🧪 PLAN DE PRUEBAS: Mejora del Módulo de Histórico de Tipos de Cambio

**Fecha:** 2025-11-05  
**Objetivo:** Pruebas exhaustivas (unitarias, integración y regresión) para nuevo módulo y funcionalidades existentes

---

## 📋 TABLA DE CONTENIDOS

1. [Estrategia de Testing](#estrategia-de-testing)
2. [Pruebas Unitarias](#pruebas-unitarias)
3. [Pruebas de Integración](#pruebas-de-integración)
4. [Pruebas de Regresión](#pruebas-de-regresión)
5. [Pruebas de Performance](#pruebas-de-performance)
6. [Pruebas de UX/Aceptación](#pruebas-de-uxaceptación)
7. [Checklist de Testing](#checklist-de-testing)

---

## 🎯 ESTRATEGIA DE TESTING

### Pirámide de Testing

```
        /\
       /  \      E2E Tests (10%)
      /____\
     /      \    Integration Tests (30%)
    /________\
   /          \  Unit Tests (60%)
  /____________\
```

### Cobertura Objetivo

- **Unitarias:** 80% de cobertura de código
- **Integración:** 100% de flujos críticos
- **Regresión:** 100% de funcionalidades existentes
- **Performance:** Validación de tiempos de respuesta

---

## 🔬 PRUEBAS UNITARIAS

### Backend - Endpoints

#### 1. `GET /api/treasury/exchange-rates/range`

**Casos de Prueba:**

```typescript
describe('GET /api/treasury/exchange-rates/range', () => {
  test('debe retornar datos para rango de fechas válido', async () => {
    // Arrange
    const startDate = '2025-01-01';
    const endDate = '2025-01-07';
    
    // Act
    const response = await request(app)
      .get('/api/treasury/exchange-rates/range')
      .query({ startDate, endDate, rateType: 'buy' })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toBeArray();
    expect(response.body[0]).toHaveProperty('date');
    expect(response.body[0]).toHaveProperty('santander');
  });
  
  test('debe validar rango máximo de 1 año', async () => {
    // Arrange
    const startDate = '2024-01-01';
    const endDate = '2025-12-31'; // Más de 1 año
    
    // Act
    const response = await request(app)
      .get('/api/treasury/exchange-rates/range')
      .query({ startDate, endDate, rateType: 'buy' })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('máximo 1 año');
  });
  
  test('debe filtrar por fuentes seleccionadas', async () => {
    // Arrange
    const sources = ['monex', 'santander'];
    
    // Act
    const response = await request(app)
      .get('/api/treasury/exchange-rates/range')
      .query({ 
        startDate: '2025-01-01',
        endDate: '2025-01-07',
        rateType: 'buy',
        sources: sources
      })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert
    expect(response.status).toBe(200);
    response.body.forEach((point: any) => {
      expect(point).not.toHaveProperty('dof');
    });
  });
  
  test('debe agrupar correctamente por intervalo (día)', async () => {
    // Arrange
    const interval = 'day';
    
    // Act
    const response = await request(app)
      .get('/api/treasury/exchange-rates/range')
      .query({ 
        startDate: '2025-01-01',
        endDate: '2025-01-07',
        rateType: 'buy',
        interval
      })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body.length).toBeLessThanOrEqual(7); // Máximo 7 días
  });
  
  test('debe requerir autenticación', async () => {
    // Act
    const response = await request(app)
      .get('/api/treasury/exchange-rates/range')
      .query({ startDate: '2025-01-01', endDate: '2025-01-07' });
    
    // Assert
    expect(response.status).toBe(401);
  });
});
```

#### 2. `GET /api/treasury/exchange-rates/stats`

**Casos de Prueba:**

```typescript
describe('GET /api/treasury/exchange-rates/stats', () => {
  test('debe calcular estadísticas correctamente', async () => {
    // Arrange
    const startDate = '2025-01-01';
    const endDate = '2025-01-07';
    
    // Act
    const response = await request(app)
      .get('/api/treasury/exchange-rates/stats')
      .query({ startDate, endDate, rateType: 'buy' })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toBeArray();
    expect(response.body[0]).toHaveProperty('source');
    expect(response.body[0]).toHaveProperty('average');
    expect(response.body[0]).toHaveProperty('max');
    expect(response.body[0]).toHaveProperty('min');
    expect(response.body[0]).toHaveProperty('volatility');
    expect(response.body[0]).toHaveProperty('trend');
    
    // Validar que promedio está entre min y max
    expect(response.body[0].average).toBeGreaterThanOrEqual(response.body[0].min);
    expect(response.body[0].average).toBeLessThanOrEqual(response.body[0].max);
  });
  
  test('debe calcular tendencia correctamente (sube)', async () => {
    // Arrange: Datos con tendencia ascendente
    // Act
    const response = await request(app)
      .get('/api/treasury/exchange-rates/stats')
      .query({ 
        startDate: '2025-01-01',
        endDate: '2025-01-07',
        rateType: 'buy',
        source: 'monex'
      })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body[0].trend).toBe('up');
  });
  
  test('debe calcular volatilidad correctamente', async () => {
    // Act
    const response = await request(app)
      .get('/api/treasury/exchange-rates/stats')
      .query({ 
        startDate: '2025-01-01',
        endDate: '2025-01-07',
        rateType: 'buy'
      })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert
    expect(response.status).toBe(200);
    response.body.forEach((stat: any) => {
      expect(stat.volatility).toBeGreaterThanOrEqual(0);
      expect(typeof stat.volatility).toBe('number');
    });
  });
});
```

#### 3. Modificación de Endpoints Existentes

**Compatibility Tests:**

```typescript
describe('GET /api/treasury/exchange-rates/daily (Compatibilidad)', () => {
  test('debe mantener comportamiento actual sin parámetros nuevos', async () => {
    // Act: Sin parámetros nuevos (comportamiento actual)
    const response = await request(app)
      .get('/api/treasury/exchange-rates/daily')
      .query({ rateType: 'buy' })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert: Debe funcionar igual que antes
    expect(response.status).toBe(200);
    expect(response.body).toBeArray();
    // Validar formato de respuesta (compatible con componente actual)
    expect(response.body[0]).toHaveProperty('hour');
    expect(response.body[0]).toHaveProperty('timestamp');
  });
  
  test('debe aceptar parámetro opcional days (default: 1)', async () => {
    // Act: Sin parámetro days (default)
    const response1 = await request(app)
      .get('/api/treasury/exchange-rates/daily')
      .query({ rateType: 'buy' })
      .set('Authorization', `Bearer ${token}`);
    
    // Act: Con parámetro days=1 (explícito)
    const response2 = await request(app)
      .get('/api/treasury/exchange-rates/daily')
      .query({ rateType: 'buy', days: 1 })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert: Deben ser equivalentes
    expect(response1.body.length).toBe(response2.body.length);
  });
  
  test('debe aceptar parámetro opcional sources[]', async () => {
    // Act
    const response = await request(app)
      .get('/api/treasury/exchange-rates/daily')
      .query({ 
        rateType: 'buy',
        sources: ['monex', 'santander']
      })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toBeArray();
  });
});
```

### Frontend - Componentes

#### 1. `PeriodSelector`

```typescript
describe('PeriodSelector', () => {
  test('debe renderizar opciones de periodo correctamente', () => {
    const { getByText } = render(<PeriodSelector value="1w" onChange={jest.fn()} />);
    
    expect(getByText('1 semana')).toBeInTheDocument();
    expect(getByText('1 mes')).toBeInTheDocument();
    expect(getByText('3 meses')).toBeInTheDocument();
    expect(getByText('6 meses')).toBeInTheDocument();
    expect(getByText('1 año')).toBeInTheDocument();
  });
  
  test('debe llamar onChange al seleccionar periodo', () => {
    const onChange = jest.fn();
    const { getByText } = render(<PeriodSelector value="1w" onChange={onChange} />);
    
    fireEvent.click(getByText('3 meses'));
    
    expect(onChange).toHaveBeenCalledWith('3m');
  });
});
```

#### 2. `SourceFilter`

```typescript
describe('SourceFilter', () => {
  test('debe renderizar checkboxes para cada fuente', () => {
    const { getByLabelText } = render(
      <SourceFilter 
        selectedSources={['monex']} 
        onChange={jest.fn()} 
      />
    );
    
    expect(getByLabelText('MONEX')).toBeInTheDocument();
    expect(getByLabelText('Santander')).toBeInTheDocument();
    expect(getByLabelText('DOF')).toBeInTheDocument();
  });
  
  test('debe marcar fuentes seleccionadas', () => {
    const { getByLabelText } = render(
      <SourceFilter 
        selectedSources={['monex', 'santander']} 
        onChange={jest.fn()} 
      />
    );
    
    expect(getByLabelText('MONEX')).toBeChecked();
    expect(getByLabelText('Santander')).toBeChecked();
    expect(getByLabelText('DOF')).not.toBeChecked();
  });
  
  test('debe llamar onChange al cambiar selección', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <SourceFilter 
        selectedSources={[]} 
        onChange={onChange} 
      />
    );
    
    fireEvent.click(getByLabelText('MONEX'));
    
    expect(onChange).toHaveBeenCalledWith(['monex']);
  });
});
```

#### 3. `ExchangeRateStats`

```typescript
describe('ExchangeRateStats', () => {
  test('debe mostrar métricas correctamente', () => {
    const stats = [
      {
        source: 'monex',
        average: 20.5,
        max: 21.0,
        min: 20.0,
        volatility: 0.3,
        trend: 'up'
      }
    ];
    
    const { getByText } = render(<ExchangeRateStats stats={stats} />);
    
    expect(getByText('MONEX')).toBeInTheDocument();
    expect(getByText('20.50')).toBeInTheDocument(); // Promedio
    expect(getByText('21.00')).toBeInTheDocument(); // Máximo
    expect(getByText('20.00')).toBeInTheDocument(); // Mínimo
  });
  
  test('debe mostrar indicador de tendencia', () => {
    const stats = [
      {
        source: 'monex',
        average: 20.5,
        max: 21.0,
        min: 20.0,
        volatility: 0.3,
        trend: 'up'
      }
    ];
    
    const { getByText } = render(<ExchangeRateStats stats={stats} />);
    
    expect(getByText('Alza')).toBeInTheDocument();
  });
});
```

#### 4. Cálculos de Estadísticas

```typescript
describe('calculateStats', () => {
  test('debe calcular promedio correctamente', () => {
    const data = [20.0, 20.5, 21.0, 20.5];
    const stats = calculateStats(data);
    
    expect(stats.average).toBe(20.5);
  });
  
  test('debe calcular máximo y mínimo correctamente', () => {
    const data = [20.0, 20.5, 21.0, 20.5];
    const stats = calculateStats(data);
    
    expect(stats.max).toBe(21.0);
    expect(stats.min).toBe(20.0);
  });
  
  test('debe calcular volatilidad (desviación estándar) correctamente', () => {
    const data = [20.0, 20.5, 21.0, 20.5];
    const stats = calculateStats(data);
    
    expect(stats.volatility).toBeCloseTo(0.408, 2);
  });
  
  test('debe detectar tendencia ascendente', () => {
    const data = [20.0, 20.5, 21.0, 21.5];
    const stats = calculateStats(data);
    
    expect(stats.trend).toBe('up');
  });
  
  test('debe detectar tendencia descendente', () => {
    const data = [21.5, 21.0, 20.5, 20.0];
    const stats = calculateStats(data);
    
    expect(stats.trend).toBe('down');
  });
  
  test('debe detectar tendencia estable', () => {
    const data = [20.5, 20.5, 20.5, 20.5];
    const stats = calculateStats(data);
    
    expect(stats.trend).toBe('stable');
  });
});
```

---

## 🔗 PRUEBAS DE INTEGRACIÓN

### Flujo Completo: Filtros → Consulta → Visualización

```typescript
describe('Flujo Completo: Exchange Rate History', () => {
  test('debe cargar datos al seleccionar periodo y fuentes', async () => {
    // Arrange
    const { getByText, getByLabelText } = render(
      <ExchangeRateHistory />
    );
    
    // Act: Seleccionar periodo
    fireEvent.click(getByText('3 meses'));
    
    // Act: Seleccionar fuentes
    fireEvent.click(getByLabelText('MONEX'));
    fireEvent.click(getByLabelText('Santander'));
    
    // Assert: Debe hacer query con parámetros correctos
    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining([
            '/api/treasury/exchange-rates/range',
            expect.objectContaining({
              period: '3m',
              sources: ['monex', 'santander']
            })
          ])
        })
      );
    });
  });
  
  test('debe actualizar gráfica al cambiar filtros', async () => {
    // Arrange
    const { getByText, getByLabelText } = render(
      <ExchangeRateHistory />
    );
    
    // Act: Cambiar periodo
    fireEvent.click(getByText('1 mes'));
    
    // Assert: Gráfica debe actualizarse
    await waitFor(() => {
      expect(screen.getByTestId('exchange-rate-chart')).toBeInTheDocument();
    });
  });
  
  test('debe mostrar estadísticas al cargar datos', async () => {
    // Arrange: Mock de datos
    mockQuery.mockResolvedValue({
      data: mockExchangeRateData,
      stats: mockStats
    });
    
    const { getByText } = render(<ExchangeRateHistory />);
    
    // Act: Esperar carga
    await waitFor(() => {
      expect(getByText('MONEX')).toBeInTheDocument();
    });
    
    // Assert: Estadísticas deben estar visibles
    expect(getByText('20.50')).toBeInTheDocument(); // Promedio
    expect(getByText('21.00')).toBeInTheDocument(); // Máximo
  });
});
```

### Integración con React Query

```typescript
describe('React Query Integration', () => {
  test('debe invalidar cache al cambiar filtros', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ExchangeRateHistory />
      </QueryClientProvider>
    );
    
    // Act: Cambiar filtro
    fireEvent.click(getByText('6 meses'));
    
    // Assert: Debe invalidar queries relacionadas
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['/api/treasury/exchange-rates/range']
      });
    });
  });
  
  test('debe usar cache correctamente', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 5 * 60 * 1000 }
      }
    });
    
    // Primera consulta
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <ExchangeRateHistory />
      </QueryClientProvider>
    );
    
    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
    
    // Segunda consulta (debe usar cache)
    rerender(
      <QueryClientProvider client={queryClient}>
        <ExchangeRateHistory />
      </QueryClientProvider>
    );
    
    // Assert: No debe hacer nueva consulta (usa cache)
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
```

---

## 🔄 PRUEBAS DE REGRESIÓN

### Validación de Funcionalidades Existentes

#### Backend - Endpoints Existentes

```typescript
describe('Regresión: Endpoints Existentes', () => {
  test('GET /api/treasury/exchange-rates/daily debe funcionar igual que antes', async () => {
    // Act: Llamada sin parámetros nuevos
    const response = await request(app)
      .get('/api/treasury/exchange-rates/daily')
      .query({ rateType: 'buy' })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert: Formato de respuesta debe ser igual
    expect(response.status).toBe(200);
    expect(response.body).toBeArray();
    expect(response.body[0]).toHaveProperty('hour');
    expect(response.body[0]).toHaveProperty('timestamp');
    expect(response.body[0]).toHaveProperty('santander');
    expect(response.body[0]).toHaveProperty('monex');
    expect(response.body[0]).toHaveProperty('dof');
  });
  
  test('GET /api/treasury/exchange-rates/monthly debe funcionar igual que antes', async () => {
    // Act: Llamada sin parámetros nuevos
    const response = await request(app)
      .get('/api/treasury/exchange-rates/monthly')
      .query({ year: 2025, month: 1, rateType: 'buy' })
      .set('Authorization', `Bearer ${token}`);
    
    // Assert: Formato de respuesta debe ser igual
    expect(response.status).toBe(200);
    expect(response.body).toBeArray();
    expect(response.body[0]).toHaveProperty('day');
    expect(response.body[0]).toHaveProperty('date');
    expect(response.body[0]).toHaveProperty('santander');
  });
});
```

#### Frontend - Componente Existente

```typescript
describe('Regresión: ExchangeRateHistory Component', () => {
  test('debe funcionar con feature flag desactivado', () => {
    // Arrange: Feature flag desactivado
    jest.spyOn(useFeatureFlag, 'useFeatureFlag').mockReturnValue(false);
    
    // Act
    const { container } = render(<ExchangeRateHistory />);
    
    // Assert: Debe renderizar componente viejo
    expect(container.querySelector('.exchange-rate-history-v1')).toBeInTheDocument();
    expect(container.querySelector('.exchange-rate-history-v2')).not.toBeInTheDocument();
  });
  
  test('debe mantener funcionalidad de selector de tipo de cambio', () => {
    const { getByText } = render(<ExchangeRateHistory />);
    
    // Act: Cambiar tipo de cambio
    fireEvent.click(getByText('Venta'));
    
    // Assert: Debe actualizar query
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining([
          expect.objectContaining({ rateType: 'sell' })
        ])
      })
    );
  });
  
  test('debe mantener funcionalidad de vista diaria/mensual', () => {
    const { getByText } = render(<ExchangeRateHistory />);
    
    // Act: Cambiar a vista mensual
    fireEvent.click(getByText('Mensual'));
    
    // Assert: Debe mostrar selector de mes
    expect(getByText('Enero 2025')).toBeInTheDocument();
  });
});
```

### Otros Componentes que Usan Exchange Rates

```typescript
describe('Regresión: Otros Componentes', () => {
  test('ExchangeRateCards debe seguir funcionando', async () => {
    const { getByText } = render(<ExchangeRateCards />);
    
    await waitFor(() => {
      expect(getByText('Santander')).toBeInTheDocument();
      expect(getByText('MONEX')).toBeInTheDocument();
      expect(getByText('DOF')).toBeInTheDocument();
    });
  });
  
  test('FxModule debe seguir funcionando', async () => {
    const { getByText } = render(<FxModule />);
    
    await waitFor(() => {
      expect(getByText('Tipo de Cambio')).toBeInTheDocument();
    });
  });
  
  test('DofChart debe seguir funcionando', async () => {
    const { container } = render(<DofChart />);
    
    await waitFor(() => {
      expect(container.querySelector('.dof-chart')).toBeInTheDocument();
    });
  });
});
```

---

## ⚡ PRUEBAS DE PERFORMANCE

### Backend - Tiempos de Respuesta

```typescript
describe('Performance: Endpoints', () => {
  test('GET /api/treasury/exchange-rates/range debe responder en < 2s (1 semana)', async () => {
    const startTime = Date.now();
    
    const response = await request(app)
      .get('/api/treasury/exchange-rates/range')
      .query({ 
        startDate: '2025-01-01',
        endDate: '2025-01-07',
        rateType: 'buy'
      })
      .set('Authorization', `Bearer ${token}`);
    
    const duration = Date.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(2000); // < 2 segundos
  });
  
  test('GET /api/treasury/exchange-rates/range debe responder en < 5s (1 año)', async () => {
    const startTime = Date.now();
    
    const response = await request(app)
      .get('/api/treasury/exchange-rates/range')
      .query({ 
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        rateType: 'buy',
        interval: 'month'
      })
      .set('Authorization', `Bearer ${token}`);
    
    const duration = Date.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(5000); // < 5 segundos
  });
  
  test('GET /api/treasury/exchange-rates/stats debe responder en < 2s', async () => {
    const startTime = Date.now();
    
    const response = await request(app)
      .get('/api/treasury/exchange-rates/stats')
      .query({ 
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        rateType: 'buy'
      })
      .set('Authorization', `Bearer ${token}`);
    
    const duration = Date.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(2000); // < 2 segundos
  });
});
```

### Frontend - Renderizado

```typescript
describe('Performance: Frontend', () => {
  test('debe renderizar componente en < 1s', async () => {
    const startTime = performance.now();
    
    const { container } = render(<ExchangeRateHistory />);
    
    await waitFor(() => {
      expect(container.querySelector('.exchange-rate-chart')).toBeInTheDocument();
    });
    
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(1000); // < 1 segundo
  });
  
  test('debe actualizar gráfica en < 500ms al cambiar filtros', async () => {
    const { getByText } = render(<ExchangeRateHistory />);
    
    await waitFor(() => {
      expect(screen.getByTestId('exchange-rate-chart')).toBeInTheDocument();
    });
    
    const startTime = performance.now();
    fireEvent.click(getByText('3 meses'));
    
    await waitFor(() => {
      expect(screen.getByTestId('exchange-rate-chart')).toBeInTheDocument();
    });
    
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(500); // < 500ms
  });
});
```

### Carga de Datos

```typescript
describe('Performance: Carga de Datos', () => {
  test('debe manejar 1 año de datos sin problemas de memoria', async () => {
    // Arrange: Mock de 1 año de datos (365 días * 3 fuentes)
    const largeDataset = generateMockData(365);
    
    mockQuery.mockResolvedValue({ data: largeDataset });
    
    // Act
    const { container } = render(<ExchangeRateHistory />);
    
    // Assert: No debe crashear o usar memoria excesiva
    await waitFor(() => {
      expect(container.querySelector('.exchange-rate-chart')).toBeInTheDocument();
    });
    
    // Validar que gráfica se renderiza (puede usar virtualización)
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument();
  });
});
```

---

## 👥 PRUEBAS DE UX/ACEPTACIÓN

### Casos de Uso Principales

```typescript
describe('UX: Casos de Uso', () => {
  test('debe permitir seleccionar periodo fácilmente', () => {
    const { getByText } = render(<ExchangeRateHistory />);
    
    // Act: Seleccionar periodo
    fireEvent.click(getByText('3 meses'));
    
    // Assert: Debe mostrar feedback visual
    expect(getByText('3 meses')).toHaveClass('selected');
  });
  
  test('debe mostrar estados de carga claramente', () => {
    mockQuery.mockReturnValue({ isLoading: true });
    
    const { getByText } = render(<ExchangeRateHistory />);
    
    // Assert: Debe mostrar skeleton o spinner
    expect(getByText(/cargando/i)).toBeInTheDocument();
  });
  
  test('debe mostrar mensaje cuando no hay datos', async () => {
    mockQuery.mockResolvedValue({ data: [] });
    
    const { getByText } = render(<ExchangeRateHistory />);
    
    await waitFor(() => {
      expect(getByText(/no hay datos disponibles/i)).toBeInTheDocument();
    });
  });
  
  test('debe mostrar errores de manera clara', async () => {
    mockQuery.mockRejectedValue(new Error('Error de conexión'));
    
    const { getByText } = render(<ExchangeRateHistory />);
    
    await waitFor(() => {
      expect(getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

### Accesibilidad

```typescript
describe('A11y: Accesibilidad', () => {
  test('debe tener labels apropiados en filtros', () => {
    const { getByLabelText } = render(<ExchangeRateHistory />);
    
    expect(getByLabelText(/tipo de cambio/i)).toBeInTheDocument();
    expect(getByLabelText(/periodo/i)).toBeInTheDocument();
  });
  
  test('debe ser navegable por teclado', () => {
    const { container } = render(<ExchangeRateHistory />);
    
    // Act: Navegar con Tab
    const firstElement = container.querySelector('button, select, input');
    firstElement?.focus();
    
    // Assert: Debe tener focus
    expect(firstElement).toHaveFocus();
  });
  
  test('debe tener ARIA labels en gráficas', () => {
    const { container } = render(<ExchangeRateHistory />);
    
    const chart = container.querySelector('[role="img"]');
    expect(chart).toHaveAttribute('aria-label');
  });
});
```

---

## ✅ CHECKLIST DE TESTING

### Pre-Desarrollo

- [ ] Configurar ambiente de testing (Jest, React Testing Library)
- [ ] Configurar mocks de React Query
- [ ] Configurar mocks de API
- [ ] Crear datos de prueba (fixtures)

### Durante Desarrollo (TDD)

- [ ] Escribir tests antes de implementar funcionalidad
- [ ] Ejecutar tests en cada commit
- [ ] Mantener cobertura > 80%

### Pre-Deploy

- [ ] Ejecutar suite completa de tests
- [ ] Validar que todos los tests pasan
- [ ] Validar cobertura de código
- [ ] Ejecutar tests de regresión
- [ ] Ejecutar tests de performance
- [ ] Validar tests de accesibilidad

### Post-Deploy

- [ ] Monitorear errores en producción
- [ ] Validar funcionalidad con usuarios reales
- [ ] Recopilar feedback
- [ ] Actualizar tests según feedback

---

**Documento creado por:** Sistema de Auditoría  
**Última actualización:** 2025-11-05

