import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class UsersSchema extends BaseSchema {
    protected tableName = 'users';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id').primary().unsigned();
            table.string('first_name', 100).nullable();
            table.string('last_name', 100).nullable();
            table.string('email', 100).notNullable();
            table.timestamp('email_verified_at').nullable();
            table.string('status', 50).defaultTo('active').comment('active, inactive');
            table.string('password').notNullable();
            table.string('profile_picture', 1500).nullable();
            table.string('phone_number', 15).nullable();
            table.string('otp', 10).nullable();
            table.boolean('is_phone_verified').defaultTo(0).comment('true if phone is verified');
            table.timestamp('phone_verified_at').nullable().comment('datetime of phone verified');
            table
                .boolean('is_verified')
                .defaultTo(0)
                .comment('true indicates the account is verified');
            table.timestamp('verified_at').nullable().comment('datetime of account verified');
            table.date('dob').nullable();
            table.boolean('is_admin').defaultTo(0).comment('true indicates admin');
            table.string('type', 50).defaultTo('help').comment('help, request');
            table.decimal('latitude', 10, 8).nullable();
            table.decimal('longitude', 11, 8).nullable();

            table
                .boolean('push_notification')
                .defaultTo(1)
                .comment('true indicates enable push notification');
            table
                .boolean('sms_notification')
                .defaultTo(1)
                .comment('true indicates enable sms notification');
            table
                .boolean('helps_push_notification')
                .defaultTo(1)
                .comment('true indicates enable daily push notification about helps');
            table
                .boolean('helps_sms_notification')
                .defaultTo(1)
                .comment('true indicates enable daily sms notification about helps');
            table
                .boolean('requests_push_notification')
                .defaultTo(1)
                .comment('true indicates enable daily push notification about requests');
            table
                .boolean('requests_sms_notification')
                .defaultTo(1)
                .comment('true indicates enable  daily sms notification about requests');
            table.string('remember_me_token').nullable();
            table.timestamps(true, true);
        });
    }

    public async down() {
        this.schema.dropTable(this.tableName);
    }
}
