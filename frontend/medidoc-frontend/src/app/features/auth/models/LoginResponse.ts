import { CurrentUser } from '../../../core/models/user';

export interface LoginResponse {
  user: CurrentUser;
}