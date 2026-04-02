import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserDto } from '@checc/shared/types/auth.types';

export const CurrentUser = createParamDecorator(
  (data: keyof UserDto | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserDto;
    return data ? user[data] : user;
  },
);
