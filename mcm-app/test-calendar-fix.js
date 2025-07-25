// Test para verificar la corrección de eventos de día entero
// Este archivo simula el comportamiento de parseICS para verificar la corrección

function testCalendarFix() {
  console.log('=== Test de corrección de eventos de día entero ===\n');

  // Simular los datos que llegan del ICS
  const testCases = [
    {
      name: 'Evento de un día entero (21 julio)',
      input: {
        startDate: '2024-07-21',
        endDate: '2024-07-22',
        isAllDay: true,
        title: 'Evento de día entero'
      },
      expected: {
        startDate: '2024-07-21',
        endDate: undefined, // Debe eliminarse porque es el mismo día
        title: 'Evento de día entero'
      }
    },
    {
      name: 'Evento de múltiples días enteros (21-23 julio)',
      input: {
        startDate: '2024-07-21',
        endDate: '2024-07-24', // Termina antes del 24, así que va hasta el 23
        isAllDay: true,
        title: 'Evento múltiples días'
      },
      expected: {
        startDate: '2024-07-21',
        endDate: '2024-07-23', // Corregido: termina el 23
        title: 'Evento múltiples días'
      }
    },
    {
      name: 'Evento con hora (no debe cambiar)',
      input: {
        startDate: '2024-07-21',
        endDate: '2024-07-21',
        isAllDay: false,
        title: 'Evento con hora'
      },
      expected: {
        startDate: '2024-07-21',
        endDate: '2024-07-21', // No debe cambiar
        title: 'Evento con hora'
      }
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log('Input:', testCase.input);

    // Aplicar la lógica de corrección
    let result = { ...testCase.input };
    
    if (result.isAllDay && result.endDate) {
      // Para eventos de día entero, DTEND es exclusivo (día siguiente)
      // Así que restamos un día del endDate
      const endDate = new Date(result.endDate + 'T12:00:00'); // Use noon to avoid timezone issues
      endDate.setDate(endDate.getDate() - 1);
      const adjustedEndDate = endDate.toISOString().split('T')[0];
      
      // Si después del ajuste el end date es igual al start date,
      // es un evento de un solo día, así que eliminamos endDate
      if (adjustedEndDate === result.startDate) {
        delete result.endDate;
      } else {
        result.endDate = adjustedEndDate;
      }
    }

    console.log('Result:', result);
    console.log('Expected:', testCase.expected);
    
    // Remove isAllDay for comparison (it's not part of the final interface)
    const resultForComparison = { ...result };
    delete resultForComparison.isAllDay;
    
    const passed = JSON.stringify(resultForComparison) === JSON.stringify(testCase.expected);
    console.log(`✅ PASSED: ${passed}\n`);
    
    if (!passed) {
      console.error('❌ Test falló!');
      console.error('Diferencias encontradas');
    }
  });

  console.log('=== Fin de tests ===');
}

// Ejecutar el test
testCalendarFix();
