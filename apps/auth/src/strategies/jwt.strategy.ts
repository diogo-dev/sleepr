import { Injectable } from "@nestjs/common";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";
import { TokenPayload } from "../interfaces/token-payload.interface";


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) => 
          request?.cookies?.Authentication || 
          request?.Authentication || 
          request?.headers?.authentication, 
      ]),
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  } 

  async validate({ userId }: TokenPayload) {
    return this.usersService.getUser({ id: userId });
  }

}
