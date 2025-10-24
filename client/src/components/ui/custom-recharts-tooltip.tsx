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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        padding: '6px',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
        fontSize: '10px',
        maxWidth: customWidth,
        width: 'auto',
        textAlign: 'center'
      }}>
        <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#4b5563', fontSize: '10px' }}>
          {formattedLabel}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {payload.map((entry, index) => {
            const { value, name } = formatValue(entry.value, entry.name);
            return (
              <div 
                key={`item-${index}`} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div 
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: entry.color,
                    marginRight: '4px',
                    flexShrink: 0
                  }}
                />
                <span style={{ 
                  fontWeight: 'bold', 
                  marginRight: '4px',
                  fontSize: '9px'
                }}>
                  {name}:
                </span>
                <span style={{ fontSize: '9px' }}>
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};