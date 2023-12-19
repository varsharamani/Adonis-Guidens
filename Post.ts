import { DateTime } from 'luxon';
import {
    BaseModel,
    column,
    hasMany,
    HasMany,
    belongsTo,
    BelongsTo,
    manyToMany,
    ManyToMany,
    hasOne,
    HasOne,
    scope,
} from '@ioc:Adonis/Lucid/Orm';
import PostHelper from 'App/Models/PostHelper';
import User from 'App/Models/User';
import Category from 'App/Models/Category';
import PostImage from 'App/Models/PostImage';
import PostReport from 'App/Models/PostReport';
import Database from '@ioc:Adonis/Lucid/Database';
import { isEmpty } from 'App/Helpers/Common';
import Env from '@ioc:Adonis/Core/Env';
import Tag from 'App/Models/Tag';
import UserTag from 'App/Models/UserTag';

export default class Post extends BaseModel {
    @column({ isPrimary: true })
    public id: number;

    @column()
    public title: string;

    @column()
    public details: string;

    @column()
    public status: string;

    @column()
    public fulfilled_by: string;

    @column.dateTime()
    public fulfilled_at: DateTime;

    @column()
    public come_to_you: boolean;

    @column()
    public require_more_peoples: boolean;

    @column()
    public latitude: string;

    @column()
    public longitude: string;

    @column()
    public location: string;

    @column()
    public city: string;

    @column()
    public country: string;

    @column()
    public created_by: number;

    @column()
    public help_by: number;

    @column()
    public distance: number;

    @column.dateTime({ autoCreate: true })
    public createdAt: DateTime;

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    public updatedAt: DateTime;

    public static STATUS_ACTIVE = 'active';
    public static STATUS_INACTIVE = 'inactive';
    public static STATUS_EXPIRED = 'expired';
    public static STATUS_CANCELED = 'canceled';
    public static STATUS_COMPLETED = 'completed';
    public static STATUS_ARCHIVED = 'archived';
    public static STATUSES = [
        this.STATUS_ACTIVE,
        this.STATUS_INACTIVE,
        this.STATUS_EXPIRED,
        this.STATUS_CANCELED,
        this.STATUS_COMPLETED,
        this.STATUS_ARCHIVED,
    ];

    public static FULFILLED_BY_PENDING = 'pending';
    public static FULFILLED_BY_H2H = 'h2h';
    public static FULFILLED_BY_OUTSIDER = 'outsider';
    public static FULFILLED_BYES = [
        this.FULFILLED_BY_PENDING,
        this.FULFILLED_BY_H2H,
        this.FULFILLED_BY_OUTSIDER,
    ];

    public static distance = scope((query, latitude, longitude, miles, selectOnly = false) => {
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
        if (!selectOnly) {
            query.whereRaw(distanceQuery + ' < ' + miles);
        }
    });

    @belongsTo(() => User, {
        foreignKey: 'created_by', // userId column on "Post" model
    })
    public user: BelongsTo<typeof User>;

    @hasMany(() => PostHelper, {
        foreignKey: 'post_id',
    })
    public postHelpers: HasMany<typeof PostHelper>;

    @manyToMany(() => Category, {
        pivotForeignKey: 'post_id',
        pivotTable: 'post_categories',
    })
    public categories: ManyToMany<typeof Category>;

    @hasMany(() => PostImage, {
        foreignKey: 'post_id',
    })
    public postImages: HasMany<typeof PostImage>;

    // has many
    @hasMany(() => PostReport, {
        foreignKey: 'post_id',
    })
    public postReports: HasMany<typeof PostReport>;

    // required for specific case
    @hasOne(() => PostReport, {
        foreignKey: 'post_id',
    })
    public postReport: HasOne<typeof PostReport>;

    @hasMany(() => PostReport, {
        foreignKey: 'post_id',
    })
    public reportedPost: HasMany<typeof PostReport>;

    @belongsTo(() => User, {
        foreignKey: 'help_by',
    })
    public helpBy: BelongsTo<typeof User>;

    @manyToMany(() => Tag, {
        pivotForeignKey: 'post_id',
        pivotTable: UserTag.table,
    })
    public tags: ManyToMany<typeof Tag>;
}
