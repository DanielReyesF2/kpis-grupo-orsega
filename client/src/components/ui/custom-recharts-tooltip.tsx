import { TooltipProps } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  formatter?: (value: any, name: any, props?: any) => [string, string];
  labelFormatter?: (label: any) => string;
  customWidth?: string;
}

export const CustomTooltip = ({ 
  active, 
  payload, 
  label,
  formatter,
  labelFormatter,
  customWidth = '150px' 
}: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const formatValue = (value: any, name: any) => {
    if (formatter) {
      const [formattedValue, formattedName] = formatter(value, name);
      return { value: formattedValue, name: formattedName };
    }
    return { value, name };
  };

  const formattedLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <div style={{
      pointerEvents: 'none',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      padding: '8px 12px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      border: '1px solid rgba(0, 0, 0, 0.1)',
      fontSize: '11px',
      maxWidth: customWidth,
      minWidth: '120px',
      zIndex: 50
    }}>
      <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: '#1f2937', fontSize: '11px' }}>
        {formattedLabel}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {payload.map((entry, index) => {
          const { value, name } = formatValue(entry.value, entry.name);
          return (
            <div
              key={`item-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: entry.color,
                  flexShrink: 0
                }}
              />
              <span style={{
                fontWeight: '600',
                fontSize: '10px',
                color: '#374151'
              }}>
                {name}:
              </span>
              <span style={{ fontSize: '10px', fontWeight: '500', color: '#111827' }}>
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};