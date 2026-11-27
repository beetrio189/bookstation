import { CreateModeratorDto } from '../../admin/dto/create-moderator.dto';

// Giống tạo KDV: { email, name, note? }; worker tự sinh mật khẩu rồi gửi mail
export class CreateEditorDto extends CreateModeratorDto {}
