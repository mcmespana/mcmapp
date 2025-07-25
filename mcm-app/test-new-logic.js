// Test simplificado para verificar la nueva lógica
function testNewLogic() {
  console.log('=== Test de nueva lógica ===\n');

  const testEvents = [
    {
      title: 'Evento día entero (hoy)',
      startDate: '2025-07-22',
      endDate: '2025-07-23', // Original ICS
      isAllDay: true
    },
    {
      title: 'Evento múltiples días',
      startDate: '2025-07-22',
      endDate: '2025-07-25', // Original ICS
      isAllDay: true
    },
    {
      title: 'Evento con hora',
      startDate: '2025-07-22',
      endDate: '2025-07-22',
      isAllDay: false
    }
  ];

  testEvents.forEach((event, index) => {
    console.log(`\nEvento ${index + 1}: ${event.title}`);
    console.log('Antes:', event);

    let processed = { ...event };

    // Aplicar la nueva lógica
    if (processed.isAllDay && processed.endDate) {
      const endDate = new Date(processed.endDate + 'T12:00:00');
      endDate.setDate(endDate.getDate() - 1);
      const adjustedEndDate = endDate.toISOString().split('T')[0];
      
      if (adjustedEndDate === processed.startDate) {
        processed.isSingleDay = true;
      } else {
        processed.endDate = adjustedEndDate;
        processed.isSingleDay = false;
      }
    }

    console.log('Después:', processed);

    // Test de clasificación
    const isSingleDay = processed.isSingleDay === true || !processed.endDate || processed.startDate === processed.endDate;
    const isMultiDay = processed.isSingleDay === false || (processed.endDate && processed.startDate !== processed.endDate && !processed.isSingleDay);

    console.log(`Clasificación: ${isSingleDay ? 'SINGLE DAY' : ''} ${isMultiDay ? 'MULTI DAY' : ''}`);
  });

  console.log('\n=== Fin test ===');
}

testNewLogic();
