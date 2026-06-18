import { TestBed } from '@angular/core/testing';

import { TechnicienService } from './technicien.service';

describe('Technicien', () => {
  let service: TechnicienService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TechnicienService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
