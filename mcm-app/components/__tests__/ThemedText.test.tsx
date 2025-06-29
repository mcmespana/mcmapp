import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemedText } from '../ThemedText';

jest.mock('../../hooks/useThemeColor', () => ({
  useThemeColor: () => 'red',
}));

describe('ThemedText', () => {
  it('renders children', () => {
    const { getByText } = render(<ThemedText>Hola</ThemedText>);
    expect(getByText('Hola')).toBeTruthy();
  });
});
