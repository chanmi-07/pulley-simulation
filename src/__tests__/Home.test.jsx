import {render, screen} from '@testing-library/react';
import Home from '../app/page';

describe('Home', () => {
  test('renders without crashing', () => {
    render(<Home />);
    const headingElement = screen.getByText('Pulley Simulation');
    expect(headingElement).toBeInTheDocument();
  });
});
