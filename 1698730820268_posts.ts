import BaseSchema from '@ioc:Adonis/Lucid/Schema';

export default class extends BaseSchema {
    protected tableName = 'posts';

    public async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.bigIncrements('id').primary().unsigned();
            table.string('title', 700).notNullable();
            table.string('details', 1500).nullable();
            table
                .string('status', 50)
                .defaultTo('active')
                .comment('active, inactive, expired, canceled, completed, archived');
            table.string('fulfilled_by', 50).defaultTo('pending').comment('pending, h2h, outsider');
            table
                .boolean('come_to_you')
                .defaultTo(false)
                .comment('true if requester wants helper come to you.');
            table.decimal('latitude', 10, 8).nullable();
            table.decimal('longitude', 11, 8).nullable();
            table.string('location').nullable();
            table.string('city', 100).nullable();
            table.string('country', 100).defaultTo('US');
            table.bigInteger('created_by').unsigned().notNullable().index();
            table.bigInteger('help_by').unsigned().nullable().index();
            table.timestamp('created_at', { useTz: true });
            table.timestamp('updated_at', { useTz: true });

            // foreign key
            table.foreign('created_by').references('users.id').onDelete('CASCADE');
            table.foreign('help_by').references('users.id').onDelete('CASCADE');
        });
    }

    public async down() {
        this.schema.alterTable(this.tableName, (table) => {
            table.dropForeign('created_by');
            table.dropForeign('help_by');
        });

        this.schema.dropTable(this.tableName);
    }
}
