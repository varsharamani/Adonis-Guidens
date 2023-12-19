import Database from '@ioc:Adonis/Lucid/Database';
import Env from '@ioc:Adonis/Core/Env';
import { DateTime } from 'luxon';
import Hash from '@ioc:Adonis/Core/Hash';
import {
    column,
    beforeSave,
    BaseModel,
    hasOne,
    HasOne,
    belongsTo,
    BelongsTo,
    manyToMany,
    ManyToMany,
    hasMany,
    HasMany,
    scope,
} from '@ioc:Adonis/Lucid/Orm';

import Identification from 'App/Models/Identification';
import UserBlock from 'App/Models/UserBlock';
import Category from 'App/Models/Category';
import PostHelper from 'App/Models/PostHelper';
import UserFeedback from 'App/Models/UserFeedback';
import UserReport from 'App/Models/UserReport';
import Notification from './Notification';
import { isEmpty } from 'App/Helpers/Common';

export default class User extends BaseModel {
    // public serializeExtras = true;

    @column({ isPrimary: true })
    public id: number;

    @column()
    public first_name: string;

    @column()
    public last_name: string;

    @column()
    public email: string;

    @column()
    public status: string;

    @column({ serializeAs: null })
    public password: string;

    @column()
    public profile_picture: string;

    @column()
    public phone_number: string;

    @column()
    public otp: string | null;

    @column()
    public is_phone_verified: boolean;

    @column.dateTime()
    public phone_verified_at: DateTime | null;

    @column()
    public is_verified: boolean;

    @column.dateTime()
    public verified_at: DateTime | null;

    @column()
    public dob: Date | string | null;

    @column()
    public is_admin: boolean;

    @column()
    public type: string;

    @column()
    public latitude: string;

    @column()
    public longitude: string;

    @column()
    public persona_id: string;

    @column()
    public push_notification: boolean;

    @column()
    public sms_notification: boolean;

    @column()
    public helps_push_notification: boolean;

    @column()
    public helps_sms_notification: boolean;

    @column()
    public requests_push_notification: boolean;

    @column()
    public requests_sms_notification: boolean;

    @column.dateTime()
    public email_verified_at: DateTime;

    @column({ serializeAs: null })
    public rememberMeToken?: string;

    @column.dateTime({ autoCreate: true })
    public createdAt: DateTime;

    @column.dateTime({ autoCreate: true, autoUpdate: true, serializeAs: null })
    public updatedAt: DateTime;

    @beforeSave()
    public static async hashPassword(User: User) {
        if (User.$dirty.password) {
            User.password = await Hash.make(User.password);
        }
    }

    public static STATUS_ACTIVE = 'active';
    public static STATUS_INACTIVE = 'inactive';
    public static STATUSES = [this.STATUS_ACTIVE, this.STATUS_INACTIVE];

    public static TYPE_HELP = 'help';
    public static TYPE_REQUEST = 'request';
    public static TYPES = [this.TYPE_HELP, this.TYPE_REQUEST];

    @hasOne(() => Identification, {
        foreignKey: 'user_id',
    })
    public identification: HasOne<typeof Identification>;

    @belongsTo(() => UserBlock, {
        foreignKey: 'created_by',
    })
    public userBlocks: BelongsTo<typeof UserBlock>;

    @manyToMany(() => Category, {
        pivotForeignKey: 'user_id',
        pivotTable: 'user_categories',
    })
    public categories: ManyToMany<typeof Category>;

    @belongsTo(() => PostHelper, { foreignKey: 'requestor_id' })
    public requestorUser: BelongsTo<typeof PostHelper>;

    @hasMany(() => PostHelper, {
        foreignKey: 'helper_id',
    })
    public helperUser: HasMany<typeof PostHelper>;

    // feedback related to login user.
    @hasMany(() => UserFeedback, {
        foreignKey: 'user_id',
    })
    public userFeedback: HasMany<typeof UserFeedback>;

    @hasMany(() => UserReport, {
        foreignKey: 'user_id',
    })
    public reportedUser: HasMany<typeof UserReport>;

    @hasMany(() => Notification, {
        foreignKey: 'user_id',
    })
    public notifications: HasMany<typeof Notification>;

    // scopes
    public static distance = scope((query, latitude, longitude, miles) => {
        miles = !isEmpty(miles) ? miles : Env.get('DEFAULT_MILES', 5);
        const distanceQuery =
            "( 3959 * acos( cos( radians( '" +
            latitude +
            "' ) ) * cos( radians( latitude ) ) * cos( radians( longitude ) - radians( '" +
            longitude +
            "' ) ) + sin( radians( '" +
            latitude +
            "' ) ) * sin( radians(latitude)) ) )";

        query.select('*', Database.raw(distanceQuery + ' AS distance'));

        // query.having('distance', '<', miles);
        query.whereRaw(distanceQuery + ' < ' + miles);
    });
}
