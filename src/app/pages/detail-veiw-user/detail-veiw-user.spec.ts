import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailViewUser } from './detail-veiw-user';

describe('DetailVeiwUser', () => {
  let component: DetailViewUser;
  let fixture: ComponentFixture<DetailViewUser>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailViewUser]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetailViewUser);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
