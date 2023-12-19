import Env from '@ioc:Adonis/Core/Env';
import { Exception } from '@adonisjs/core/build/standalone';
import { rules, schema } from '@ioc:Adonis/Core/Validator';
import { DateTime } from 'luxon';
import User from 'App/Models/User';
import VerifyEmailMailer from 'App/Mailers/VerifyEmailMailer';
import UserAuthResource from 'App/Resources/UserAuthResource';
import {
    returnResponse,
    getRandomInt,
    fileUpload,
    getImageExtensions,
    sendTwilioSms,
    getImageSize,
    isEmpty,
} from 'App/Helpers/Common';
import Identification from 'App/Models/Identification';
import Hash from '@ioc:Adonis/Core/Hash';
import Device from 'App/Models/Device';
import { firebaseNotification } from 'App/Helpers/NotificationHelper';
import PersonaHelper from 'App/Helpers/PersonaHelper';

export default class AuthController {
    public notFound = 'Login user not found, please login again';
    public statusCode = 422;

    public async login({ auth, request, response }) {
        const data = await request.validate({
            schema: schema.create({
                input: schema.string([rules.trim()]),
                password: schema.string({}),
            }),
            messages: {
                'input.required': 'The input must be a valid email address or phone number.',
                'password.required': 'The {{ field }} field is required.',
            },
        });
        const message = `You have entered your email, phone number, or password incorrectly.`;

        try {
            let user: User | null = null;

            // here first find user via phone number.
            const phoneUser = await User.query()
                .where('phone_number', data.input)
                // .where('status', User.STATUS_ACTIVE)
                .first();

            // check if user found or not.
            if (phoneUser) {
                // if user found via phone assign to user variable.
                user = phoneUser;
            } else {
                // if not found check via email.
                user = await User.query()
                    .where('email', data.input)
                    // .where('status', User.STATUS_ACTIVE)
                    .first();
            }

            if (!user) {
                throw new Exception(message);
            }

            if (user.status === User.STATUS_INACTIVE) {
                throw new Exception(
                    `Your account has been archived. Please contact admin for assistance.`
                );
            }

            const token = await auth.use('api').attempt(user.email, data.password, {
                expiresIn: '1 year',
            });

            if (!isEmpty(request.input('fcm_token')) && !isEmpty(request.input('device_id'))) {
                await Device.updateOrCreate(
                    { device_id: request.input('device_id') },
                    {
                        device_id: request.input('device_id'),
                        fcm_token: request.input('fcm_token'),
                        user_id: auth.user.id,
                    }
                );
            }

            if (!user.is_verified) {
                await firebaseNotification(
                    'Welcome to heart2help',
                    'Complete your account verification.',
                    { event_code: '0', event_id: 0, event_type: '' },
                    [auth.user.id]
                );
            }

            return returnResponse(response, 'Login successful.', 200, { token: token.token });
        } catch (e) {
            if (e.code === 'E_INVALID_AUTH_PASSWORD') {
                throw new Exception(message);
            }
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async register({ request, response }) {
        const data = await request.validate({
            schema: schema.create({
                first_name: schema.string([rules.trim()]),
                last_name: schema.string([rules.trim()]),
                email: schema.string([
                    rules.trim(),
                    rules.email(),
                    rules.unique({ table: 'users', column: 'email' }),
                ]),
                password: schema.string({}, [
                    rules.minLength(8),
                    rules.regex(new RegExp(/^(?=.*[0-9])(?=.*[A-Z])(?=.*\W)(?!.* ).*$/)),
                    rules.confirmed(),
                ]),
            }),
            messages: {
                'required': 'The {{ field }} field is required.',
                'email.email': 'The email must be a valid email address.',
                'unique': 'The {{ field }} has already been taken.',
                'password.minLength': 'The password must be at-least 8 characters.',
                'password.regex':
                    'The password must contain at least one uppercase, numerical & special characters.',
                'password_confirmation.confirmed': 'The password confirmation does not match.',
            },
        });

        try {
            const user = await User.create(data);
            await PersonaHelper.createAccount(user);
            return returnResponse(response, 'Your account has been registered.', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async sendMobileOtp({ auth, response, request }) {
        const validate = await request.validate({
            schema: schema.create({
                phone: schema.string([
                    rules.trim(),
                    rules.minLength(10),
                    // rules.maxLength(13),
                    rules.unique({
                        table: 'users',
                        column: 'phone_number',
                        caseInsensitive: true,
                        whereNot: {
                            id: auth.user.id,
                        },
                    }),
                ]),
            }),
            messages: {
                required: 'The phone field is required.',
                minLength: 'The phone filed contains 10 characters.',
                // maxLength: 'The phone filed contains min 10 and max 13 characters.',
                unique: 'The phone number is already in use.',
            },
        });
        try {
            const authUser: User = auth.user;
            if (!authUser) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }

            const otp = getRandomInt(100000, 999999);
            authUser.otp = otp;
            authUser.phone_number = validate.phone;
            await authUser.save();

            const res = await sendTwilioSms(
                validate.phone,
                `Your phone verification code is ${otp}.`
            );

            if (!res.is_success) {
                throw new Exception(res.message);
            }

            let message: string = `Otp sent on ${validate.phone}.`;
            // this is for mobile side testing.
            if (Env.get('NODE_ENV') !== 'production') {
                message = `Otp sent on ${validate.phone} and OTP is ${otp}`;
            }
            return returnResponse(response, message, 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async verifyMobileOtp({ auth, response, request }) {
        const validate = await request.validate({
            schema: schema.create({
                otp: schema.string([rules.trim(), rules.minLength(6), rules.maxLength(6)]),
            }),
            messages: {
                required: 'The otp is required.',
                minLength: 'The otp is 6 digit long.',
                maxLength: 'The otp is 6 digit long.',
            },
        });
        try {
            const authUser: User = auth.user;
            if (!authUser) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }

            if (authUser.otp !== validate.otp) {
                this.statusCode = 422;
                throw new Exception('The OTP you entered is invalid.');
            }

            authUser.is_phone_verified = true;
            authUser.otp = null;
            authUser.phone_verified_at = DateTime.now();
            await authUser.save();
            await PersonaHelper.updateAccount(authUser);
            return returnResponse(response, 'OTP has verified.', 200);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async setDateOfBirth({ auth, response, request }) {
        const validate = await request.validate({
            schema: schema.create({
                dob: schema.date(
                    {
                        format: 'yyyy-MM-dd',
                    },
                    [
                        rules.before(16, 'years'), // Ensure the user is at least 16 years old
                    ]
                ),
            }),
            messages: {
                'dob': 'The dob is required.',
                'dob.before': 'The user should be at-least 16 years old.',
                'date.format': 'The date of birth format should be yyyy-MM-dd',
            },
        });

        try {
            const authUser: User = auth.user;
            if (!authUser) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }

            validate.dob = new Date(validate.dob);
            const year = validate.dob.getFullYear();

            if (year === 0) {
                throw new Exception('The date of birth must include valid date');
            }

            authUser.dob = validate.dob;
            await authUser.save();

            return returnResponse(response, 'Date of birth added successfully', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async setLatLng({ auth, response, request }) {
        const validate = await request.validate({
            schema: schema.create({
                latitude: schema.number([
                    rules.range(-90, 90), // Valid latitude range
                ]),
                longitude: schema.number([
                    rules.range(-180, 180), // Valid longitude range
                ]),
            }),
        });

        try {
            const authUser: User = auth.user;
            if (!authUser) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }

            authUser.latitude = validate.latitude;
            authUser.longitude = validate.longitude;
            await authUser.save();

            return returnResponse(response, 'latitude longitude added successfully', 200);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async idVerification({ auth, response, request }) {
        const validate = await request.validate({
            schema: schema.create({
                type: schema.enum(Identification.TYPES as string[]),
                file: schema.file({
                    size: getImageSize(),
                    extnames: getImageExtensions(),
                }),
            }),
            messages: {
                'required': 'The {{ field }} field is required',
                'type.enum': 'The {{ field }} only contains below choices.',
                'file.size': 'The file max size is 10mb.',
            },
        });

        try {
            const authUser: User = auth.user;
            if (!authUser) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }
            /******************************************/
            // here persona implementation are pending
            /******************************************/
            const fileName = await fileUpload(validate.file);
            await Identification.create({
                front_photo: fileName['filePath'],
                user_id: auth.user.id,
                type: validate.type,
                is_verified: true,
                verified_at: DateTime.now(),
            });

            authUser.is_verified = true;
            authUser.verified_at = DateTime.now();
            await authUser.save();

            return returnResponse(response, 'ID Verification has been successfully.', 200);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async logout({ auth, response, request }) {
        try {
            const deviceId = request.input('device_id');
            if (!isEmpty(deviceId)) {
                await Device.query().where('device_id', deviceId).delete();
            }

            await auth.use('api').revoke();
            return returnResponse(response, 'Logout successfully', 200);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async user({ auth, response }) {
        const user = auth.user;
        await user.load('categories');
        await user.load('identification', (query: any) => {
            query.where('persona_status', Identification.STATUS_APPROVED);
        });

        return returnResponse(
            response,
            'Here are your account details',
            200,
            await UserAuthResource.resource(user)
        );
    }

    public async update({ auth, request, response }) {
        const user: User = auth.user;

        const validate = await request.validate({
            schema: schema.create({
                first_name: schema.string([rules.trim(), rules.minLength(3), rules.maxLength(100)]),
                last_name: schema.string([rules.trim(), rules.minLength(3), rules.maxLength(100)]),
                email: schema.string([
                    rules.email(),
                    rules.unique({
                        table: 'users',
                        column: 'email',
                        caseInsensitive: true,
                        whereNot: {
                            id: user.id,
                        },
                    }),
                ]),
                profile_picture: schema.file.optional({
                    size: getImageSize(),
                    extnames: getImageExtensions(),
                }),
                dob: schema.date.optional(
                    {
                        format: 'yyyy-MM-dd',
                    },
                    [
                        rules.before(16, 'years'), // Ensure the user is at least 16 years old
                    ]
                ),
                phone_number: schema.string([
                    rules.trim(),
                    rules.minLength(10),
                    // rules.maxLength(13),
                    rules.unique({
                        table: 'users',
                        column: 'phone_number',
                        caseInsensitive: true,
                        whereNot: {
                            id: user.id,
                        },
                    }),
                ]),
            }),
            messages: {
                'first_name.required': 'The first name field is required.',
                'last_name.required': 'The last name field is required.',
                'required': 'The {{ field }} is required.',
                'dob.format': 'The dob format should be yyyy-MM-dd',
                'phone_number.required': 'The phone field is required.',
                'phone_number.minLength': 'The phone filed contains 10 characters.',
                // 'phone_number.maxLength': 'The phone filed contains min 10 and max 13 characters.',
                'phone_number.unique': 'The phone number is already in use.',
                'minLength': 'The {{field}} contains min 3 and max 100 character long. ',
                'maxLength': 'The {{field}} contains min 3 and max 100 character long. ',
                'unique': 'The {{ field }} is already in use.',
            },
        });

        try {
            if (validate['profile_picture']) {
                const imgAttr = await fileUpload(validate.profile_picture);
                validate['profile_picture'] = imgAttr['filePath'];
            }

            if (!isEmpty(validate.dob)) {
                validate.dob = new Date(validate.dob);
                const year = validate.dob.getFullYear();

                if (year === 0) {
                    throw new Exception('The date of birth must include valid date.');
                }
            }
            let message = 'Your account details has been updated.';
            // send otp to verify new phone number
            if (user.phone_number !== validate.phone_number) {
                const otp = getRandomInt(100000, 999999);
                validate.otp = otp;

                const res = await sendTwilioSms(
                    validate.phone_number,
                    `Your phone verification code is ${otp}.`
                );

                if (!res.is_success) {
                    throw new Exception(res.message);
                }

                // message += ` and Otp sent on ${validate.phone_number}.`;
                // // this is for mobile side testing.
                // if (Env.get('NODE_ENV') !== 'production') {
                //     message += ` and Otp sent on ${validate.phone_number} and OTP is ${otp}`;
                // }
            }
            await user.merge(validate).save();
            await PersonaHelper.updateAccount(user);
            return returnResponse(response, message, 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async uploadProfilePicture({ response, auth, request }) {
        const validate = await request.validate({
            schema: schema.create({
                profile_picture: schema.file({
                    size: getImageSize(),
                    extnames: getImageExtensions(),
                }),
            }),
        });

        try {
            const user: User = auth.user;
            const profilePicture = await fileUpload(validate.profile_picture);

            user.profile_picture = profilePicture['filePath'];
            await user.save();
            return returnResponse(response, 'Profile picture has been uploaded.', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async resendVerificationEmail({ auth, response }) {
        try {
            new VerifyEmailMailer(auth.user).send();
            return {
                success: 'Please check your email inbox (and spam) for an access link.',
            };
        } catch (e) {
            return response.unprocessableEntity({ error: e.message });
        }
    }

    public async verifyEmail({ params, request, response }) {
        if (!request.hasValidSignature()) {
            return response.unprocessableEntity({ error: 'Invalid verification link.' });
        }

        const email = decodeURIComponent(params.email);
        const user = await User.query().where('id', params.id).where('email', email).first();
        if (!user) {
            return response.unprocessableEntity({ error: 'Invalid verification link.' });
        }

        user.email_verified_at = DateTime.utc();
        await user.save();

        return { success: 'Email verified successfully.' };
    }

    public async changePassword({ request, response, auth }) {
        const data = await request.validate({
            schema: schema.create({
                current_password: schema.string(),
                password: schema.string({}, [
                    rules.minLength(8),
                    rules.regex(new RegExp(/^(?=.*[0-9])(?=.*[A-Z])(?=.*\W)(?!.* ).*$/)),
                    rules.confirmed(),
                ]),
            }),
            messages: {
                'current_password.required': 'The current password field is required.',
                'required': 'The {{ field }} field is required.',
                'minLength': 'The password must be at-least 8 characters.',
                'password.regex':
                    'The password must contain at least one uppercase, numerical & special characters.',
                'password_confirmation.required': 'The password confirmation field is required.',
                'password_confirmation.confirmed':
                    'The password confirmation does not match password.',
            },
        });

        try {
            const user = auth.user;

            const isPasswordValid = await Hash.verify(auth.user.password, data.current_password);
            if (!isPasswordValid) {
                throw new Exception('Current password is incorrect.');
            }

            user.password = data.password;
            await user.save();

            return returnResponse(response, 'Admin password has been changed successfully', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }
}
