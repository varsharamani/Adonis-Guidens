import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class extends BaseSchema {
    protected tableName = 'devices';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.bigInteger('user_id').unsigned().notNullable().index();
            table.string('device_id').comment('login device id.');
            table.string('fcm_token').comment('firebase fcm token.');
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });

            // foreign key
            table.foreign('user_id').references('users.id').onDelete('CASCADE');
        });
    }

    public async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign('user_id');
        });
        this.schema.dropTable(this.tableName);
    }
}
