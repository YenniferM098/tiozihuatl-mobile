import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PullRefresh } from './pull-refresh';

describe('PullRefresh - deslizar para actualizar (#229)', () => {
  it('cierra el indicador cuando termina la recarga, no antes', () => {
    const loading = signal(false);
    const pull = TestBed.runInInjectionContext(() => new PullRefresh(loading));
    const complete = vi.fn();
    loading.set(true);
    pull.start({ target: { complete } } as unknown as Event);
    TestBed.tick();
    expect(complete).not.toHaveBeenCalled();
    loading.set(false);
    TestBed.tick();
    expect(complete).toHaveBeenCalledTimes(1);
    loading.set(true); loading.set(false);
    TestBed.tick();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('si la recarga ya terminó, cierra el indicador de inmediato', () => {
    const pull = TestBed.runInInjectionContext(() => new PullRefresh(signal(false)));
    const complete = vi.fn();
    pull.start({ target: { complete } } as unknown as Event);
    TestBed.tick();
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
