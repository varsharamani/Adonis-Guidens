import User from 'App/Models/User';
import { getFileUrl } from 'App/Helpers/Common';

export default class UserResource {
    /************************/
    /** @param options holds key and pair **/
    /** @eg {key : value} **/
    /** structure designed by https://github.com/miteshviras */
    /************************/

    public static async resource(array: User) {
        const reportedUsers: any[] = [];
        if (array.reportedUser) {
            await Promise.all(
                array.reportedUser.map(async (reportedUser) => {
                    reportedUsers.push({
                        created_by: reportedUser.created_by,
                        reason: reportedUser.reason,
                        comment: reportedUser.comment,
                        status: reportedUser.status,
                        created_at: reportedUser.createdAt
                            ? reportedUser.createdAt.toFormat('yyyy-MM-dd HH:mm:ss')
                            : null,
                        createdBy: reportedUser.createdBy,
                    });
                })
            );
        }

        if (array.identification && array.identification.front_photo) {
            const file: any = await getFileUrl(array.identification.front_photo);
            array.identification.front_photo = file;
        }
        if (array.identification && array.identification.back_photo) {
            const file: any = await getFileUrl(array.identification.back_photo);
            array.identification.back_photo = file;
        }
        return Object.assign({
            id: array.id,
            first_name: array.first_name,
            last_name: array.last_name,
            full_name: array.first_name + ' ' + array.last_name,
            email: array.email,
            email_verified_at: array.email_verified_at ?? null,
            status: array.status,
            profile_picture: array.profile_picture ? await getFileUrl(array.profile_picture) : null,
            phone_number: array.phone_number ?? null,
            is_phone_verified: array.is_phone_verified,
            phone_verified_at: array.phone_verified_at,
            is_verified: array.is_verified ?? null,
            verified_at: array.verified_at ?? null,
            dob: array.dob ?? null,
            type: array.type,
            userDocuments: array.identification,
            latitude: array.latitude ?? null,
            longitude: array.longitude ?? null,
            push_notification: array.push_notification ?? true,
            sms_notification: array.sms_notification ?? true,
            helps_push_notification: array.helps_push_notification ?? true,
            helps_sms_notification: array.helps_sms_notification ?? true,
            requests_push_notification: array.requests_push_notification ?? true,
            requests_sms_notification: array.requests_sms_notification ?? true,
            created_at: array.createdAt ? array.createdAt.toFormat('yyyy-MM-dd HH:mm:ss') : null,
            reportedUser: reportedUsers ?? [],
        });
    }

    public static async collection(users: User[], meta: any[]) {
        return {
            data: await Promise.all(
                users.map(async (array: User) => {
                    return await this.resource(array);
                })
            ),
            meta: meta,
        };
    }
}
