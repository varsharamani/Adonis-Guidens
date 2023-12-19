import Category from 'App/Models/Category';
import { getFileUrl } from 'App/Helpers/Common';

export default class CategoryResource {
    public static async resource(array: Category) {
        return Object.assign({
            id: array.id,
            title: array.title,
            icon: array.icon ? await getFileUrl(array.icon) : null,
            is_active: array.is_active ?? array.is_active,
            created_at: array.createdAt ? array.createdAt.toFormat('yyyy-MM-dd HH:mm:ss') : null,
        });
    }

    public static async collection(users: Category[], meta: any[]) {
        return {
            data: await Promise.all(
                users.map(async (array: Category) => {
                    return await this.resource(array);
                })
            ),
            meta: meta,
        };
    }
}
