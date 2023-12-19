import { getFileUrl } from 'App/Helpers/Common';
import User from 'App/Models/User';

export default class UserAuthResource {
    /************************/
    /** @param options holds key and pair **/
    /** @eg {key : value} **/
    /** structure designed by https://github.com/miteshviras */
    /************************/

    public static async resource(user: User) {
        const identification = user.toJSON().identification;
        if (identification) {
            identification.front_photo = identification.front_photo
                ? await getFileUrl(identification.front_photo)
                : null;
            identification.back_photo = identification.back_photo
                ? await getFileUrl(identification.back_photo)
                : null;
        }
        return Object.assign({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            email_verified_at: user.email_verified_at ?? null,
            status: user.status,
            profile_picture: user.profile_picture ? await getFileUrl(user.profile_picture) : null,
            phone_number: user.phone_number ?? null,
            is_phone_verified: user.is_phone_verified,
            phone_verified_at: user.phone_verified_at,
            is_verified: user.is_verified ?? null,
            verified_at: user.verified_at ?? null,
            dob: user.dob ?? null,
            type: user.type,
            latitude: user.latitude ?? null,
            longitude: user.longitude ?? null,
            push_notification: user.push_notification ? 1 : 0,
            sms_notification: user.sms_notification ? 1 : 0,
            helps_push_notification: user.helps_push_notification ? 1 : 0,
            helps_sms_notification: user.helps_sms_notification ? 1 : 0,
            requests_push_notification: user.requests_push_notification ? 1 : 0,
            requests_sms_notification: user.requests_sms_notification ? 1 : 0,
            categories: user.categories ? user.categories : [],
            identification: identification,
        });
    }
}
