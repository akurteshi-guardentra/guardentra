import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { FastTrackStageBar } from '../components/spine/FastTrackStageBar';

function renderBar(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <FastTrackStageBar />
    </MemoryRouter>
  );
}

describe('FastTrackStageBar location is not completion', () => {
  it('does not mark Review & decide complete when the current stage is Monitor', () => {
    const { container } = renderBar('/assessments?focus=monitor');

    const review = screen.getByRole('link', { name: /Review & decide/ });
    expect(review).toHaveAttribute('data-stage-state', 'available');
    expect(review.className).not.toMatch(/emerald/);
    expect(review.querySelector('span')?.className ?? '').not.toMatch(/emerald/);

    const monitor = screen.getByText('Monitor').closest('[data-stage-state]');
    expect(monitor).toHaveAttribute('data-stage-state', 'current');
    expect(monitor).toHaveAttribute('aria-current', 'step');

    expect(container.querySelector('[class*="emerald"]')).toBeNull();
  });

  it('keeps earlier stages available, not complete, on Review & decide', () => {
    renderBar('/assessments');

    const vendors = screen.getByRole('link', { name: /Add vendor/ });
    expect(vendors).toHaveAttribute('data-stage-state', 'available');
    expect(vendors.className).not.toMatch(/emerald/);

    const review = screen.getByText('Review & decide').closest('[data-stage-state]');
    expect(review).toHaveAttribute('data-stage-state', 'current');
  });
});
