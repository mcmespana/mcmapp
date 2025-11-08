import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';

interface GlassHeaderProps {
  tintColor?: string;
}

export default function GlassHeader({ tintColor }: GlassHeaderProps) {
  // Verificar si LiquidGlass está disponible (iOS 18+)
  const glassAvailable = isLiquidGlassAvailable();

  // Determinar el color de fondo basado en el tintColor
  // Para colores claros (amarillo, gris claro), usar opacidad más alta
  // Para colores oscuros, usar opacidad más baja para mantener el efecto glass
  let backgroundColor: string;
  let glassStyle: 'clear' | 'light' | 'dark' = 'clear';
  
  if (tintColor) {
    // Convertir hex a RGB para determinar si es claro u oscuro
    const hex = tintColor.replace('#', '');
    // Manejar tanto formato de 6 caracteres como formato corto de 3
    const r = parseInt(hex.length === 6 ? hex.substring(0, 2) : hex[0] + hex[0], 16);
    const g = parseInt(hex.length === 6 ? hex.substring(2, 4) : hex[1] + hex[1], 16);
    const b = parseInt(hex.length === 6 ? hex.substring(4, 6) : hex[2] + hex[2], 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    if (brightness > 180) {
      // Color claro - usar más opacidad para mejor legibilidad
      backgroundColor = tintColor + 'F0'; // 94% opacidad
      glassStyle = 'light';
    } else {
      // Color oscuro - usar menos opacidad para efecto glass
      backgroundColor = tintColor + 'D0'; // 82% opacidad
      glassStyle = 'dark';
    }
  } else {
    backgroundColor = 'rgba(255, 255, 255, 0.95)';
    glassStyle = 'light';
  }

  if (glassAvailable) {
    // Usar LiquidGlass cuando está disponible
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor }]}>
        <GlassView
          glassEffectStyle={glassStyle}
          style={StyleSheet.absoluteFill}
        />
        {/* Borde sutil en la parte inferior para separar del contenido */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
          }}
        />
      </View>
    );
  }

  // Fallback para iOS < 18 con BlurView mejorado
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        tint={glassStyle === 'dark' ? 'dark' : 'light'}
        intensity={glassStyle === 'dark' ? 80 : 100}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor },
        ]}
      />
      {/* Borde sutil en la parte inferior para separar del contenido */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
        }}
      />
    </View>
  );
}
