import Env from '@ioc:Adonis/Core/Env';
import { Exception } from '@adonisjs/core/build/standalone';
import { schema, rules } from '@ioc:Adonis/Core/Validator';
import {
    fileUpload,
    getImageExtensions,
    getImageSize,
    isEmpty,
    returnResponse,
} from 'App/Helpers/Common';
import Post from 'App/Models/Post';
import PostCategory from 'App/Models/PostCategory';
import PostImage from 'App/Models/PostImage';
import PostResource from 'App/Resources/PostResource';
import PostReport from 'App/Models/PostReport';
import UserFeedback from 'App/Models/UserFeedback';
import { getBlockUserList } from 'App/Helpers/UserHelpers';
import {
    sendNotification,
    firebaseNotification,
    getNotificationCodes,
} from 'App/Helpers/NotificationHelper';
import Notification from 'App/Models/Notification';
import Tag from 'App/Models/Tag';
import UserTag from 'App/Models/UserTag';
import PostHelper from 'App/Models/PostHelper';
import User from 'App/Models/User';
import { DateTime } from 'luxon';

export default class PostsController {
    public statusCode = 500;
    public notFound = 'Post not found.';
    public pageSize = Env.get('PAGE_SIZE') ?? 20;

    public async index({ response, request, auth }) {
        try {
            const page = request.input('page', 1);
            const limit = request.input('limit', this.pageSize);

            const validate = await request.validate({
                schema: schema.create({
                    // search: schema.string.optional(),
                    // sort_order: schema.string.optional(),
                    // sort_column: schema.string.optional(),
                    categories: schema.string.optional([rules.maxLength(255)]),
                    limit: schema.number.optional(),
                    latitude: schema.number.optional([
                        rules.range(-90, 90), // Valid latitude range
                    ]),
                    longitude: schema.number.optional([
                        rules.range(-180, 180), // Valid longitude range
                    ]),
                    miles: schema.number.optional([
                        rules.range(1, 500), // Valid miles range
                    ]),
                }),
            });
            const categoriesIds = isEmpty(validate['categories'])
                ? []
                : validate['categories'].split(',');
            const blockUserIds = await getBlockUserList(auth.user.id);
            const posts = await Post.query()
                .if(validate.longitude && validate.latitude, (query) => {
                    query.apply((scope) =>
                        scope.distance(validate.latitude, validate.longitude, validate.miles)
                    );
                })
                // .if(validate.city, (query) => {
                //     query.where('city', validate.city);
                // })
                .where('status', Post.STATUS_ACTIVE)
                .whereNotIn('created_by', blockUserIds)
                .whereHas('user', (query) => {
                    query.where('status', User.STATUS_ACTIVE);
                })
                .whereDoesntHave('postHelpers', (query) => {
                    query.where('helper_id', auth.user.id);
                })
                .if(categoriesIds.length, (query) => {
                    query.whereHas('categories', (query) => {
                        query.whereIn('categories.id', categoriesIds);
                    });
                })
                .preload('postImages')
                .preload('categories')
                .preload('user', (query) => {
                    query.select('id', 'first_name', 'last_name', 'email', 'profile_picture');
                })
                .preload('postReport', (postReport) => {
                    postReport
                        .where('created_by', auth.user.id)
                        .where('status', PostReport.STATUS_PENDING);
                })
                .preload('tags', (tagsQuery) => {
                    tagsQuery.select('id', 'title', 'count');
                })
                .orderBy('id', 'desc')
                .paginate(page, limit);
            // adding queryString and baseurl in meta links - needs to add manually.
            posts.queryString(validate);
            posts.baseUrl(request.url());
            return returnResponse(
                response,
                'Post listing.',
                200,
                await PostResource.collection(posts.toJSON().data, posts.toJSON().meta)
            );
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async store({ response, request, auth }) {
        const validate = await request.validate(await this.commonValidation());
        try {
            const images = validate.images;
            delete validate['images'];

            const categoryIds = validate['categories'];
            delete validate['categories'];

            const tags = isEmpty(validate['tags']) ? [] : validate['tags'].split(',');
            delete validate['tags'];

            validate['created_by'] = auth.user.id;
            const post = await Post.create(validate);

            if (!isEmpty(categoryIds)) {
                // await Promise.all(
                const postCategory = categoryIds.map((id: any) => {
                    return new Object({ category_id: id, post_id: post.id });
                });

                await PostCategory.createMany(postCategory);
                // );
            }

            if (!isEmpty(tags)) {
                const userTag = await Promise.all(
                    tags.map(async (tag) => {
                        return new Object({ title: tag });
                    })
                );
                const tagsObj = await Tag.updateOrCreateMany('title', userTag);
                const tagsIds = tagsObj.map(
                    (tag) => new Object({ post_id: post.id, tag_id: tag.id, user_id: auth.user.id })
                );
                UserTag.createMany(tagsIds);
            }

            if (!isEmpty(images)) {
                const postImages: any = await Promise.all(
                    images.map(async (img) => {
                        const imgAttr = await fileUpload(img);
                        return new Object({
                            post_id: post.id,
                            file_name: imgAttr['fileName'],
                            url: imgAttr['filePath'],
                        });
                    })
                );
                await PostImage.createMany(postImages);
            }

            if (!isEmpty(post.latitude) && !isEmpty(post.longitude)) {
                const usersNearBy = await User.query()
                    .where('status', User.STATUS_ACTIVE)
                    .where((query) => {
                        query.apply((scope) =>
                            scope.distance(post.latitude, post.longitude, Env.get('DEFAULT_MILES'))
                        );
                    })
                    .exec();

                if (usersNearBy.length > 0) {
                    firebaseNotification(
                        'New post created',
                        `${post.title}`,
                        {
                            event_code: getNotificationCodes('view_post'),
                            event_id: post.id,
                            event_type: 'view_post',
                        },
                        usersNearBy.map((user) => {
                            return user.id;
                        })
                    );
                }
            }

            await sendNotification(Notification.NOTIFY_POST, post);
            return returnResponse(response, 'Your post has been created successfully..', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async show({ request, response, params, auth }) {
        const validate = await request.validate({
            schema: schema.create({
                latitude: schema.number.optional([
                    rules.range(-90, 90), // Valid latitude range
                ]),
                longitude: schema.number.optional([
                    rules.range(-180, 180), // Valid longitude range
                ]),
            }),
        });
        try {
            const blockUserIds = await getBlockUserList(auth.user.id);
            const post = await Post.query()
                .if(validate.longitude && validate.latitude, (query) => {
                    query.apply((scope) =>
                        scope.distance(validate.latitude, validate.longitude, 0, true)
                    );
                })
                .where('id', params.id)
                .whereNotIn('created_by', blockUserIds)
                .preload('categories', (categories) => {
                    categories.select('id', 'title', 'icon', 'is_active');
                })
                .preload('user', (query) => {
                    query.select('id', 'first_name', 'last_name', 'email', 'profile_picture');
                })
                .preload('postReport', (postReport) => {
                    postReport
                        .where('created_by', auth.user.id)
                        .where('status', PostReport.STATUS_PENDING);
                })
                .preload('postImages', (postImages) => {
                    postImages.select('id', 'post_id', 'file_name', 'url');
                })
                .preload('tags', (tagsQuery) => {
                    tagsQuery.select('id', 'title', 'count');
                })
                .first();

            if (!post) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }

            if (auth.user.id === post.created_by) {
                await post.load('postHelpers', (postHelpers) => {
                    postHelpers.select('id', 'helper_id', 'status', 'message');
                    postHelpers.preload('helperUser', (helperUser) => {
                        helperUser.select(
                            'id',
                            'first_name',
                            'last_name',
                            'profile_picture',
                            'email',
                            'status',
                            'type'
                        );
                    });
                });
            }

            return returnResponse(
                response,
                'Here are you post details.',
                200,
                await PostResource.resource(post)
            );
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async update({ response, request, auth, params }) {
        const validate = await request.validate(await this.commonValidation());
        try {
            const post = await Post.query()
                .where('id', params.id)
                .where('created_by', auth.user.id)
                .first();

            if (!post) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }

            const tags = isEmpty(validate['tags']) ? [] : validate['tags'].split(',');
            delete validate['tags'];

            const images = validate.images;
            delete validate['images'];

            const categoryIds = validate['categories'];
            delete validate['categories'];

            const deleteImageIds = isEmpty(validate['remove_images'])
                ? []
                : validate['remove_images'].split(',');
            delete validate['remove_images'];

            await post.merge(validate).save();

            await PostCategory.query().where('post_id', post.id).delete();
            if (!isEmpty(categoryIds)) {
                // await Promise.all(
                const postCategory = categoryIds.map((id: any) => {
                    return new Object({ category_id: id, post_id: post.id });
                });

                await PostCategory.createMany(postCategory);
                // );
            }

            await UserTag.query().where('post_id', post.id).delete();
            if (!isEmpty(tags)) {
                const userTag = await Promise.all(
                    tags.map(async (tag) => {
                        return new Object({ title: tag });
                    })
                );
                const tagsObj = await Tag.updateOrCreateMany('title', userTag);
                const tagsIds = tagsObj.map(
                    (tag) => new Object({ post_id: post.id, tag_id: tag.id, user_id: auth.user.id })
                );
                UserTag.createMany(tagsIds);
            }

            if (!isEmpty(images)) {
                const postImages: any = await Promise.all(
                    images.map(async (img) => {
                        const imgAttr = await fileUpload(img);
                        return new Object({
                            post_id: post.id,
                            file_name: imgAttr['fileName'],
                            url: imgAttr['filePath'],
                        });
                    })
                );
                await PostImage.createMany(postImages);
            }

            if (!isEmpty(deleteImageIds)) {
                await PostImage.query().whereIn('id', deleteImageIds).delete();
            }

            return returnResponse(response, 'Your post has been updated successfully..', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async destroy({ response, auth, params }) {
        try {
            const post = await Post.query()
                .where('id', params.id)
                .where('created_by', auth.user.id)
                .first();

            if (!post) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }
            await post.delete();
            return returnResponse(response, 'Your post has been deleted successfully..', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async history({ auth, response, request }) {
        const validate = await request.validate({
            schema: schema.create({
                limit: schema.number.optional(),
                filter: schema.enum.optional(Post.STATUSES as string[]),
            }),
            messages: {
                'filter.enum': 'Filter should be {{options.choices}}.',
            },
        });

        try {
            const page = request.input('page', 1);
            const limit = request.input('limit', this.pageSize);

            const posts = await Post.query()
                .where('created_by', auth.user.id)
                .if(validate.filter, (query) => {
                    query.where('status', validate.filter);
                })
                .preload('postImages')
                .preload('categories')
                .preload('postReport', (postReport) => {
                    postReport
                        .where('created_by', auth.user.id)
                        .where('status', PostReport.STATUS_PENDING);
                })
                .preload('tags', (tagsQuery) => {
                    tagsQuery.select('id', 'title', 'count');
                })
                .orderBy('id', 'desc')
                .paginate(page, limit);
            // adding queryString and baseurl in meta links - needs to add manually.
            posts.queryString(validate);
            posts.baseUrl(request.url());

            return returnResponse(
                response,
                'Here are you post history.',
                200,
                await PostResource.collection(posts.toJSON().data, posts.toJSON().meta)
            );
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    private async commonValidation() {
        return {
            schema: schema.create({
                title: schema.string([rules.minLength(2), rules.maxLength(200)]),
                details: schema.string([rules.minLength(2), rules.maxLength(560)]),
                categories: schema.array.optional([rules.minLength(1)]).members(schema.number()),
                tags: schema.string.optional([rules.maxLength(512)]),
                require_more_peoples: schema.boolean.optional(),
                come_to_you: schema.boolean.optional(),
                latitude: schema.number.optional([
                    rules.range(-90, 90), // Valid latitude range
                ]),
                longitude: schema.number.optional([
                    rules.range(-180, 180), // Valid longitude range
                ]),
                images: schema.array.optional([]).members(
                    schema.file({
                        size: getImageSize(),
                        extnames: getImageExtensions(),
                    })
                ),
                remove_images: schema.string.optional([rules.maxLength(512)]),
            }),
            messages: {
                'categories.*.required': 'The categories contain at least 1 category.',
                'tags.maxLength': 'The tags contains max 512 characters long.',
                'required': 'The {{ field }} is required.',
                'title.minLength': 'The title should contains min 2 characters long.',
                'title.maxLength': 'The title contains max 100 characters long.',
                'details.minLength': 'The details contains min 2 characters long.',
                'details.maxLength': 'The details contains max 280 characters long.',
                'latitude.range': 'Invalid latitude range',
                'longitude.range': 'Invalid longitude range',
                'categories.array': 'Something wrong with categories.',
                'images.array': 'Something wrong with images.',
            },
        };
    }

    public async statusUpdate({ request, response, params, auth }) {
        const data = await request.validate({
            schema: schema.create({
                status: schema.enum(Post.STATUSES as string[]),
            }),
            messages: {
                'status.enum': 'Status should be {{options.choices}}.',
            },
        });

        try {
            const requestData = await Post.query().where('id', params.post_id).first();

            if (!requestData) {
                this.statusCode = 404;
                throw new Exception('Post not found.');
            }

            if (requestData.created_by !== auth.user.id) {
                this.statusCode = 422;
                throw new Exception('You don`t have access.');
            }

            await requestData.merge({ status: data.status }).save();

            return returnResponse(response, 'Post request status updated successfully..', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async requestFulfill({ request, response, params }) {
        const data = await request.validate({
            schema: schema.create({
                is_h2h_user: schema.boolean(),
                help_by: schema.number.optional([rules.requiredWhen('is_h2h_user', '=', 'true')]),
            }),

            messages: {
                'is_h2h_user.required': 'The {{ field }} field is required.',
                'is_h2h_user.boolean': 'The {{ field }} field must be boolean.',
                'help_by.requiredWhen': 'The {{ field }} field is required.',
            },
        });

        try {
            const postData = await Post.query().where('id', params.post_id).first();

            if (!postData) {
                this.statusCode = 404;
                throw new Exception("Your post doesn't exists.");
            }

            if (data.is_h2h_user) {
                const requestData = await PostHelper.query()
                    .where('post_id', params.post_id)
                    .where('requestor_id', postData.created_by)
                    .where('helper_id', data.help_by)
                    .first();

                if (!requestData) {
                    this.statusCode = 404;
                    throw new Exception("Your request data doesn't exists.");
                }

                postData.fulfilled_by = Post.FULFILLED_BY_H2H;
                postData.help_by = data.help_by;
                postData.status = Post.STATUS_COMPLETED;
                postData.fulfilled_at = DateTime.now();

                requestData.status = PostHelper.STATUS_FULFILLED;
                await requestData.save();
            } else {
                postData.fulfilled_by = Post.FULFILLED_BY_OUTSIDER;
                postData.fulfilled_at = DateTime.now();
                postData.status = Post.STATUS_COMPLETED;
            }

            await postData.save();

            return returnResponse(response, 'Post request has been fulfilled successfully..', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async helperFeedback({ request, response, params, auth }) {
        const data = await request.validate({
            schema: schema.create({
                user_id: schema.number(),
                is_positive: schema.boolean(),
                type: schema.array
                    .optional([rules.requiredWhen('is_positive', '=', 'false')])
                    .members(schema.string()),
                reason: schema.string.optional(),
            }),

            messages: {
                'user_id.required': 'The {{ field }} field is required.',
                'user_id.number': 'The {{ field }} must be number.',
                'is_positive.required': 'The {{ field }} field is required.',
                'is_positive.boolean': 'The {{ field }} field must be boolean.',
                'type.requiredWhen': 'The {{ field }} field is required.',
                'type.array': 'The {{ field }} field must be an array.',
            },
        });

        try {
            const requestData = await Post.query().where('id', params.post_id).first();

            if (!requestData) {
                this.statusCode = 404;
                throw new Exception("Your post request doesn't exists.");
            }

            const userFeedbackData = await UserFeedback.query()
                .where('user_id', data.user_id)
                .where('post_id', params.post_id)
                .first();

            if (userFeedbackData) {
                this.statusCode = 422;
                throw new Exception('Your feedback is already exists.');
            }

            const userFeedback = new UserFeedback();
            userFeedback.post_id = params.post_id;
            userFeedback.user_id = data.user_id;
            userFeedback.created_by = auth.user.id;
            userFeedback.is_positive = data.is_positive;
            if (!data.is_positive) {
                userFeedback.type = JSON.stringify(data.type);
                userFeedback.reason = data.reason;
            }
            await userFeedback.save();

            return returnResponse(response, 'User feedback has added successfully..', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }
}
