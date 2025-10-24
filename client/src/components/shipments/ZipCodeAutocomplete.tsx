import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FormControl } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Definir interfaz para ubicaciones
interface LocationSuggestion {
  name: string;
  code: string;
  frequent?: boolean;
}

// Datos de códigos postales comunes y ubicaciones frecuentes como sugerencias
const LOCATION_SUGGESTIONS: LocationSuggestion[] = [
  // Ubicaciones frecuentes de Dura y Grupo Orsega
  { name: "Nextipac", code: "Nextipac, Jalisco", frequent: true },
  { name: "Altamira", code: "Altamira, Tamaulipas", frequent: true },
  { name: "Bodega Principal Dura", code: "CDMX", frequent: true },
  { name: "Centro Distribución Norte", code: "Nuevo León", frequent: true },
  { name: "Planta Química Dura", code: "Querétaro", frequent: true },
  { name: "Centro Logístico Orsega", code: "Jalisco", frequent: true },
  { name: "Terminal de Cargas Tampico", code: "Tamaulipas", frequent: true },
  { name: "Centro Operativo Sur", code: "Puebla", frequent: true },
  
  // Otras ubicaciones comunes en México
  { name: "Ciudad de México", code: "CDMX" },
  { name: "Guadalajara", code: "Jalisco" },
  { name: "Monterrey", code: "Nuevo León" },
  { name: "Puebla", code: "Puebla" },
  { name: "Tijuana", code: "Baja California" },
  { name: "León", code: "Guanajuato" },
  { name: "Juárez", code: "Chihuahua" },
  { name: "Cancún", code: "Quintana Roo" },
  { name: "Mérida", code: "Yucatán" },
  { name: "Villahermosa", code: "Tabasco" }
];

interface ZipCodeAutocompleteProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
}

export function ZipCodeAutocomplete({ 
  placeholder, 
  value, 
  onChange, 
  name, 
  disabled = false 
}: ZipCodeAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  
  // Sincronizar el valor interno con el valor externo
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);
  
  // Manejar cambios en el input - entrada completamente libre
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue); // Aplicar inmediatamente sin restricciones
  };
  
  // Seleccionar una sugerencia (opcional)
  const handleSelectSuggestion = (selectedItem: typeof LOCATION_SUGGESTIONS[0]) => {
    const formattedValue = `${selectedItem.name}`;
    setInputValue(formattedValue);
    onChange(formattedValue);
    setOpen(false);
  };

  // Cerrar el dropdown sin cambiar el valor
  const handleClose = () => {
    setOpen(false);
  };
  
  // Filtrar sugerencias solo si hay texto de búsqueda
  const searchTerm = inputValue.toLowerCase().trim();
  const shouldShowSuggestions = searchTerm.length > 0;
  
  const frequentSuggestions = shouldShowSuggestions 
    ? LOCATION_SUGGESTIONS.filter(item => 
        item.frequent && (
          item.name.toLowerCase().includes(searchTerm) || 
          item.code.toLowerCase().includes(searchTerm)
        )
      )
    : LOCATION_SUGGESTIONS.filter(item => item.frequent);
  
  const otherSuggestions = shouldShowSuggestions 
    ? LOCATION_SUGGESTIONS.filter(item => 
        !item.frequent && (
          item.name.toLowerCase().includes(searchTerm) || 
          item.code.toLowerCase().includes(searchTerm)
        )
      )
    : [];
  
  const hasSuggestions = frequentSuggestions.length > 0 || otherSuggestions.length > 0;
  
  return (
    <div className="relative w-full">
      <FormControl>
        <div className="relative">
          <Input
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            disabled={disabled}
            name={name}
            autoComplete="off"
            className="w-full pr-10"
          />
          {inputValue && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
              onClick={() => {
                setInputValue("");
                onChange("");
              }}
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </Button>
          )}
        </div>
      </FormControl>
      
      {/* Sugerencias opcionales */}
      {open && hasSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {frequentSuggestions.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">Ubicaciones Frecuentes</div>
              {frequentSuggestions.map((item, index) => (
                <button
                  key={`frequent-${index}`}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md flex items-center"
                  onClick={() => handleSelectSuggestion(item)}
                >
                  <MapPin className="mr-2 h-4 w-4 text-primary" />
                  <span className="font-medium">{item.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{item.code}</span>
                </button>
              ))}
            </div>
          )}
          
          {otherSuggestions.length > 0 && (
            <div className="p-2 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-2">Otras Ubicaciones</div>
              {otherSuggestions.map((item, index) => (
                <button
                  key={`other-${index}`}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md flex items-center"
                  onClick={() => handleSelectSuggestion(item)}
                >
                  <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{item.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{item.code}</span>
                </button>
              ))}
            </div>
          )}
          
          <div className="p-2 border-t bg-gray-50 text-xs text-muted-foreground">
            💡 Escribe libremente cualquier ubicación. Las sugerencias son opcionales.
          </div>
        </div>
      )}
    </div>
  );
}