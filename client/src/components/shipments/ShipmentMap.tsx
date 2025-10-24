import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon, DivIcon, LatLngExpression, Marker as LeafletMarker } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCoordinates } from '@/utils/geo-utils';

// Corrige el problema de íconos para Leaflet en React
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Componente para centrar el mapa en las coordenadas apropiadas
function SetMapView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  
  return null;
}

// Componente para crear un marcador animado
function MovingMarker({ 
  position, 
  icon,
  children,
  animate = false,
  previousPosition = null
}: { 
  position: [number, number], 
  icon: Icon,
  children?: React.ReactNode,
  animate?: boolean,
  previousPosition?: [number, number] | null
}) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const map = useMap();
  
  useEffect(() => {
    const marker = markerRef.current;
    const shouldAnimate = animate;
    if (!shouldAnimate || !previousPosition || !marker) return;
    
    // Crear una animación de movimiento entre la posición anterior y la nueva
    const startLatLng = L.latLng(previousPosition[0], previousPosition[1]);
    const endLatLng = L.latLng(position[0], position[1]);
    
    const animationDuration = 1500; // 1.5 segundos
    const frames = 100;
    const deltaLat = (endLatLng.lat - startLatLng.lat) / frames;
    const deltaLng = (endLatLng.lng - startLatLng.lng) / frames;
    
    let i = 0;
    const animateMovement = () => {
      if (i < frames && markerRef.current) {
        i++;
        const lat = startLatLng.lat + deltaLat * i;
        const lng = startLatLng.lng + deltaLng * i;
        markerRef.current.setLatLng([lat, lng]);
        
        requestAnimationFrame(animateMovement);
      }
    };
    
    animateMovement();
  }, [position, animate, previousPosition, map]);
  
  return (
    <Marker 
      position={position} 
      icon={icon}
      ref={markerRef}
    >
      {children}
    </Marker>
  );
}

interface Point {
  lat: number;
  lng: number;
  name: string;
}

interface ShipmentMapProps {
  origin: Point;
  destination: Point;
  currentLocation?: Point;
  status: 'pending' | 'in_transit' | 'delayed' | 'delivered' | 'cancelled';
}

export function ShipmentMap({ origin, destination, currentLocation, status }: ShipmentMapProps) {
  // Hack para corregir los iconos de Leaflet en entornos de bundling
  useEffect(() => {
    // @ts-ignore - Este es un hack conocido para Leaflet en entornos de bundling
    delete L.Icon.Default.prototype._getIconUrl;
    
    // @ts-ignore
    L.Icon.Default.mergeOptions({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
    });
  }, []);

  // Ajuste de posición según el estado:
  // - Si es entregado, el vehículo debe estar en la posición de destino
  // - Si hay ubicación actual, usar esa
  // - De lo contrario, colocar en un punto del camino según el estado
  let currentPos;
  if (status === 'delivered') {
    // Si está entregado, el camión está en el destino
    currentPos = {
      lat: destination.lat,
      lng: destination.lng,
      name: destination.name
    };
  } else if (currentLocation) {
    // Si hay una ubicación actual, usar esa
    currentPos = currentLocation;
  } else {
    // De lo contrario, colocar en algún punto del camino según el estado
    // Calculamos un porcentaje del camino según el estado
    let progressPercent;
    switch (status) {
      case 'pending':
        progressPercent = 0.1; // 10% del camino (cerca del origen)
        break;
      case 'in_transit':
        progressPercent = 0.5; // 50% del camino (a mitad)
        break;
      case 'delayed':
        progressPercent = 0.7; // 70% del camino
        break;
      case 'cancelled':
        progressPercent = 0.3; // 30% del camino
        break;
      default:
        progressPercent = 0.5; // 50% por defecto
    }
    
    // Interpolación de coordenadas
    currentPos = {
      lat: origin.lat + (destination.lat - origin.lat) * progressPercent,
      lng: origin.lng + (destination.lng - origin.lng) * progressPercent,
      name: 'En ruta'
    };
  }
  
  // Calcula el centro del mapa y el zoom adecuado
  const center = {
    lat: (origin.lat + destination.lat) / 2,
    lng: (origin.lng + destination.lng) / 2
  };
  
  // Crea la ruta como una polyline
  const routePoints: [number, number][] = [
    [origin.lat, origin.lng],
    [currentPos.lat, currentPos.lng],
    [destination.lat, destination.lng]
  ];
  
  // Diferentes colores según el estado
  const getRouteColor = () => {
    switch (status) {
      case 'pending':
        return '#3b82f6'; // Azul
      case 'in_transit':
        return '#f97316'; // Naranja
      case 'delayed':
        return '#ef4444'; // Rojo
      case 'delivered':
        return '#b5e951'; // Verde (Econova)
      case 'cancelled':
        return '#6b7280'; // Gris
      default:
        return '#3b82f6';
    }
  };
  
  // SVG de una pipa (camión cisterna) para transportes químicos
  const tankTruckSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="${status === 'delayed' ? 'red' : status === 'delivered' ? '#4ade80' : 'orange'}" width="36" height="36">
      <path d="M32 96c0-35.3 28.7-64 64-64H320c23.7 0 44.4 12.9 55.4 32h51.8c25.3 0 48.2 14.9 58.5 38l52.8 118.8c.5 1.1 .9 2.3 1.3 3.5 6.5 2.5 12.7 5.5 18.7 9.1 18.9 11.3 34.1 28.3 43.8 48.8 9.2 19.4 14 40.5 14.1 61.7L640 409.1v7c0 22.1-17.9 40-40 40H608c0 8.8-7.2 16-16 16s-16-7.2-16-16H378.5c0 8.8-7.2 16-16 16s-16-7.2-16-16H320 288 205.5c0 8.8-7.2 16-16 16s-16-7.2-16-16H64c-8.8 0-16-7.2-16-16V409.1C27.8 407.9 8.4 393.9 2.6 373.3c-2.1-7.9 2.5-16.1 10.4-18.3s16.1 2.5 18.3 10.4c3.3 11.9 14.2 20.2 26.7 20.5l32 .9c23.5 .7 42.9-17.8 43.6-41.2s-17.8-42.9-41.2-43.6l-25.6-.7c-12.2-.3-22.8-8.2-27.4-19.8C29.1 255.8 32 228.3 32 200.7V96zm345.6 160H485.3l-42.7-96H390.9c-3.1 5.6-6.8 10.9-11.1 15.6-14.8 16.4-34.5 27.8-57.2 31.8V256zM151.5 176c6.6-18.6 24.4-32 45.3-32h48.5c-7.4 11.4-11.2 24.4-11.2 38.1c0 38.2 30.4 69.3 68.3 70.5l.7 0c30.1-1.2 54.9-23.4 61.1-52.5H440c-.2 34.5-6.4 61.9-16.7 82.3-12.4 24.3-30.6 39.4-54 43.2-10.5 1.7-21.6 2.1-32.7 1.3-15.3 24.9-42.8 41.5-74.1 41.5c-24.7 0-46.9-10.2-62.7-26.5c-2.9-.5-5.7-1-8.6-1.5c-28.9-5.4-54.8-20.8-73.2-42.2c-13.2-15.4-22.8-33.5-28.1-53.1c-2.2-8.1-3.9-16.5-5.1-25.1l5.1 .1c8.8 .2 16.9 3.3 23.4 8.3c7.1-11.8 17.7-21.2 30.7-26.5c6.2-2.6 12.9-4.1 19.9-4.4z"/>
    </svg>
  `;

  // Crear marcadores para Origen y Destino
  const originIcon = new DivIcon({
    html: `
      <div style="position: relative; text-align: center;">
        <div style="color: #273949; font-weight: bold; background: white; padding: 2px 5px; border-radius: 3px; border: 1px solid #ccc; margin-bottom: 5px;">
          Origen
        </div>
        <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png" 
             style="width: 25px; height: 41px;" 
             alt="Origen" />
      </div>
    `,
    className: 'origin-marker-icon',
    iconSize: [40, 60],
    iconAnchor: [20, 41],
    popupAnchor: [0, -41]
  });

  const destinationIcon = new DivIcon({
    html: `
      <div style="position: relative; text-align: center;">
        <div style="color: #27674a; font-weight: bold; background: white; padding: 2px 5px; border-radius: 3px; border: 1px solid #ccc; margin-bottom: 5px;">
          Destino
        </div>
        <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png" 
             style="width: 25px; height: 41px;" 
             alt="Destino" />
      </div>
    `,
    className: 'destination-marker-icon',
    iconSize: [40, 60],
    iconAnchor: [20, 41],
    popupAnchor: [0, -41]
  });
  
  // Ícono de pipa/camión cisterna (SVG para mejor calidad)
  const truckIconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(tankTruckSvg)}`;
  
  // Para envíos entregados, usar el camión verde
  const currentIcon = new Icon({
    iconUrl: truckIconUrl,
    shadowUrl: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });

  // Estado para almacenar la posición anterior y simular animación
  const [previousPosition, setPreviousPosition] = useState<[number, number] | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true); // Iniciamos como true para animar siempre la primera vez

  // Efecto para establecer la posición inicial
  useEffect(() => {
    // Inicializa la posición anterior como la ubicación de origen
    if (!previousPosition) {
      setPreviousPosition([origin.lat, origin.lng]);
    }
  }, [origin.lat, origin.lng, previousPosition]);

  // Efecto para simular movimiento cuando cambia la ubicación actual
  useEffect(() => {
    // Siempre actualizar la posición anterior para animar
    setPreviousPosition(prevPos => {
      const oldPos = prevPos || [origin.lat, origin.lng];
      return oldPos;
    });
    
    // Forzar animación para que siempre se muestre al abrir el popup
    setShouldAnimate(true);
  }, [currentPos.lat, currentPos.lng, origin.lat, origin.lng]);

  // Calcular el zoom apropiado basado en la distancia
  const calcZoom = () => {
    const distance = Math.sqrt(
      Math.pow(origin.lat - destination.lat, 2) + 
      Math.pow(origin.lng - destination.lng, 2)
    );
    
    if (distance > 10) return 5;
    if (distance > 5) return 7;
    if (distance > 2) return 9;
    return 11;
  };

  const zoom = calcZoom();

  return (
    <div className="w-full h-[300px] rounded-lg overflow-hidden border border-gray-200">
      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
      >
        <SetMapView center={[center.lat, center.lng]} zoom={zoom} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Origen */}
        <Marker position={[origin.lat, origin.lng]} icon={originIcon}>
          <Popup>
            <strong>Origen:</strong> {origin.name}
          </Popup>
        </Marker>
        
        {/* Destino */}
        <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
          <Popup>
            <strong>Destino:</strong> {destination.name}
          </Popup>
        </Marker>
        
        {/* Ubicación actual - para envíos en progreso (no entregados o cancelados) mostrar con animación */}
        {(status !== 'cancelled') && (
          <MovingMarker 
            position={[currentPos.lat, currentPos.lng]} 
            icon={currentIcon}
            animate={status !== 'delivered' && shouldAnimate}
            previousPosition={previousPosition}
          >
            <Popup>
              <strong>
                {status === 'delayed' ? 'Retrasado en:' : 
                 status === 'in_transit' ? 'Ubicación actual:' :
                 status === 'pending' ? 'Por enviar desde:' :
                 status === 'delivered' ? 'Entregado en:' : 'Ubicación:'}
              </strong> {currentPos.name}
            </Popup>
          </MovingMarker>
        )}
        
        {/* Línea de ruta delgada estilo "entregado" para envíos completados */}
        {status === 'delivered' && (
          <Polyline 
            positions={[
              [origin.lat, origin.lng],
              [destination.lat, destination.lng]
            ]} 
            color={'#b5e951'} 
            weight={3} 
            opacity={0.7}
          />
        )}
        
        {/* Línea de ruta animada para envíos en progreso */}
        {(status !== 'delivered' && status !== 'cancelled') && (
          <Polyline 
            positions={routePoints} 
            color={getRouteColor()} 
            weight={3} 
            opacity={0.7} 
            dashArray={status === 'delayed' ? '5, 10' : ''} 
          />
        )}
      </MapContainer>
    </div>
  );
}

