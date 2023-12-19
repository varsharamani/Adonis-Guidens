import { getFileUrl } from 'App/Helpers/Common';
// import Post from 'App/Models/Post';
import User from 'App/Models/User';
import PostResource from './PostResource';

export default class UserPostResource {
    /************************/
    /** @param options holds key and pair **/
    /** @eg {key : value} **/
    /** structure designed by https://github.com/miteshviras */
    /************************/
    public static async collection(user: User, posts: any[], meta: any[]) {
        const getUser = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            full_name: `${user.first_name} ${user.last_name}`,
            email: user.email,
            profile_picture: user.profile_picture ? await getFileUrl(user.profile_picture) : null,
            is_verified: user.is_verified ? true : false,
            total_helps: user.$extras.helperUser_count ?? 0,
            thumbs_up: user.$extras.userFeedback_count ?? 0,
        };

        const categories = await Promise.all(
            user.categories.map(async (category) => {
                return {
                    id: category.id,
                    title: category.title,
                    icon: category.icon ? await getFileUrl(category.icon) : null,
                };
            })
        );
        const getPosts = await PostResource.collection(posts, meta);
        getPosts.posts.map((post) => (post.user = getUser));

        return {
            user: getUser,
            categories: categories,
            posts: getPosts,
            // posts: {
            //     data: await Promise.all(
            //         posts.map(async (post: Post) => {
            //             return {
            //                 id: post.id,
            //                 title: post.title,
            //                 details: post.details,
            //                 status: post.status,
            //                 created_at: post.createdAt,
            //                 user: getUser,
            //             };
            //         })
            //     ),
            //     meta: meta,
            // },
        };
    }
}
