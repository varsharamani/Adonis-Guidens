import { DateTime } from 'luxon';
import { BaseModel, BelongsTo, belongsTo, column } from '@ioc:Adonis/Lucid/Orm';
import User from 'App/Models/User';

export default class UserReport extends BaseModel {
    @column({ isPrimary: true })
    public id: number;

    @column()
    public user_id: number;

    @column()
    public created_by: number;

    @column()
    public reason: string;

    @column()
    public comment: string;

    @column()
    public status: string;

    @column.dateTime({ autoCreate: true })
    public createdAt: DateTime;

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    public updatedAt: DateTime;

    public static STATUS_PENDING = 'pending';
    public static STATUS_REVIEWED = 'reviewed';
    public static STATUS_CANCELED = 'canceled';
    public static STATUSES = [this.STATUS_PENDING, this.STATUS_REVIEWED, this.STATUS_CANCELED];

    @belongsTo(() => User, {
        foreignKey: 'created_by', // userId column on "Post" model
    })
    public createdBy: BelongsTo<typeof User>;

    @belongsTo(() => User, {
        foreignKey: 'user_id', // userId column on "Post" model
    })
    public user: BelongsTo<typeof User>;
}
