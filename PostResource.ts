import { getFileUrl, isEmpty } from 'App/Helpers/Common';
import Post from 'App/Models/Post';
import Tag from 'App/Models/Tag';

export default class PostResource {
    /************************/
    /** @param options holds key and pair **/
    /** @eg {key : value} **/
    /** structure designed by https://github.com/miteshviras */
    /************************/

    public static async resource(array: Post) {
        const postImages: any[] = [];
        if (array.postImages) {
            await Promise.all(
                array.postImages.map(async (imageAttr) => {
                    postImages.push({
                        id: imageAttr.id ?? null,
                        post_id: imageAttr.post_id ?? null,
                        file_name: imageAttr.file_name ?? null,
                        url: imageAttr.url ? await getFileUrl(imageAttr.url) : null,
                    });
                })
            );
        }

        const categories: any[] = [];
        if (array.categories) {
            await Promise.all(
                array.categories.map(async (category) => {
                    categories.push({
                        id: category.id,
                        title: category.title,
                        icon: category.icon ? await getFileUrl(category.icon) : null,
                        is_active: category.is_active ? 1 : 0,
                    });
                })
            );
        }

        const postHelpers = array.toJSON().postHelpers;
        if (postHelpers) {
            await Promise.all(
                postHelpers.map(async (helper: any) => {
                    helper.helperUser.profile_picture = (await getFileUrl(
                        helper.helperUser.profile_picture
                    )) as any;
                    return helper;
                })
            );
        }

        const user = array.toJSON().user;
        if (user && user.profile_picture) {
            user.profile_picture = (await getFileUrl(user.profile_picture)) as any;
        }

        const tags: string[] = [];
        if (!isEmpty(array.tags)) {
            array.tags.map((tag: Tag) => {
                tags.push(tag.title);
            });
        }

        const distance = isEmpty(array.distance) ? '0.00' : array.distance.toString();

        return Object.assign({
            id: array.id,
            title: array.title,
            details: array.details,
            status: array.status,
            fulfilled_by: array.fulfilled_by,
            fulfilled_at: array.fulfilled_at,
            come_to_you: array.come_to_you ? 1 : 0,
            latitude: array.latitude ?? null,
            longitude: array.longitude ?? null,
            location: array.location ?? null,
            distance: distance,
            city: array.city ?? null,
            country: array.country ?? null,
            created_by: array.created_by,
            help_by: array.help_by,
            categories: categories ?? [],
            images: postImages ?? [],
            tags: tags.toString(),
            user: user,
            postHelpers: postHelpers ?? [],
            is_reported: array.postReport ? 1 : 0,
            created_at: array.createdAt ?? null,
            updated_at: array.updatedAt ?? null,
        });
    }

    public static async collection(data: any[], meta: any[]) {
        return {
            posts: await Promise.all(
                data.map(async (array: Post) => {
                    return await this.resource(array);
                })
            ),
            meta: meta,
        };
    }
}
