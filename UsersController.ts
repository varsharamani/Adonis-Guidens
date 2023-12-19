import Env from '@ioc:Adonis/Core/Env';
import { Exception } from '@adonisjs/core/build/standalone';
import { schema, rules } from '@ioc:Adonis/Core/Validator';
import { isEmpty, returnResponse } from 'App/Helpers/Common';
import Post from 'App/Models/Post';
import User from 'App/Models/User';
import UserBlock from 'App/Models/UserBlock';
import UserReport from 'App/Models/UserReport';
import UserPostResource from 'App/Resources/UserPostResource';
import { sendNotification } from 'App/Helpers/NotificationHelper';
import Notification from 'App/Models/Notification';
export default class UsersController {
    public statusCode = 422;
    public pageSize = Env.get('PAGE_SIZE') ?? 20;
    public notFound = 'User not found.';

    public async index() {}

    public async create() {}

    public async store() {}

    public async show({ response, params, request }) {
        try {
            const page = request.input('page', 1);
            const limit = request.input('limit', this.pageSize);

            const validate = await request.validate({
                schema: schema.create({
                    limit: schema.number.optional(),
                    latitude: schema.number.optional([
                        rules.range(-90, 90), // Valid latitude range
                    ]),
                    longitude: schema.number.optional([
                        rules.range(-180, 180), // Valid longitude range
                    ]),
                }),
            });

            const user = await User.query()
                .where('id', params.id)
                .preload('categories', (categoriesQuery) => {
                    categoriesQuery.where('is_active', true).select('id', 'title', 'icon');
                })
                .withCount('helperUser')
                .withCount('userFeedback')
                .select('id', 'first_name', 'last_name', 'email', 'profile_picture', 'is_verified')
                .first();

            if (!user) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }

            const posts = await Post.query()
                .if(validate.longitude && validate.latitude, (query) => {
                    query.apply((scope) =>
                        scope.distance(validate.latitude, validate.longitude, 0, true)
                    );
                })
                .where('created_by', user.id)
                .whereNot('status', Post.STATUS_ARCHIVED)
                .preload('postImages')
                .preload('categories')
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
                'User details.',
                200,
                await UserPostResource.collection(user, posts.toJSON().data, posts.toJSON().meta)
            );
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async report({ response, auth, request, params }) {
        const validate = await request.validate({
            schema: schema.create({
                reason: schema.array([rules.minLength(1)]).members(schema.string()),
                comment: schema.string.optional([rules.maxLength(500)]),
            }),
            messages: {
                'required': 'The reason is required.',
                'comment.maxLength':
                    'The additional comment should max {{ options.maxLength }} characters long.',
            },
        });

        try {
            const user = await User.query()
                .where('id', params.id)
                .preload('reportedUser', (query) => {
                    query
                        .where('created_by', auth.user.id)
                        .whereIn('status', [UserReport.STATUS_PENDING]);
                })
                .first();

            if (!user) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }

            // dependent on above relationship
            if (user.reportedUser.length > 0) {
                throw new Exception('You already report this user.');
            }

            if (auth.user.id === user.id) {
                throw new Exception('You cannot report yourself.');
            }

            const userReport = await UserReport.create({
                created_by: auth.user.id,
                reason: JSON.stringify(validate.reason),
                user_id: params.id,
                comment: validate.comment,
            });

            await sendNotification(Notification.NOTIFY_USER_REPORT, userReport);

            return returnResponse(response, 'The user has been reported successfully.', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async myBlockList({ response, auth }) {
        try {
            const blockedUser = await UserBlock.query()
                .where('created_by', auth.user.id)
                .has('users')
                .preload('users', (userQuery) => {
                    userQuery.select('id', 'first_name', 'last_name', 'email', 'profile_picture');
                })
                .select('id', 'user_id', 'created_by');
            // .first();

            // if (!blockedUser) {
            //     return returnResponse(response, 'Your block list.', 200, { users: [] });
            // }

            return returnResponse(response, 'Your block list.', 200, { users: blockedUser });
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async block({ response, auth, params }) {
        try {
            if (isEmpty(params.id)) {
                this.statusCode = 422;
                throw new Exception('id is required');
            }
            const user = await User.query().where('id', params.id).first();
            if (!user) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }

            if (auth.user.id === user.id) {
                throw new Exception('You cannot block yourself.');
            }

            await UserBlock.create({ user_id: params.id, created_by: auth.user.id });
            return returnResponse(response, 'The user has been blocked successfully.', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async unblock({ response, auth, params }) {
        try {
            if (isEmpty(params.id)) {
                this.statusCode = 422;
                throw new Exception('id is required');
            }
            const blockedUser = await UserBlock.query()
                .where('created_by', auth.user.id)
                .where('user_id', params.id)
                .first();
            if (!blockedUser) {
                this.statusCode = 404;
                throw new Exception(this.notFound);
            }
            blockedUser.delete();
            return returnResponse(response, 'The user has been unblocked successfully.', 201);
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }

    public async edit() {}

    public async update() {}

    public async destroy() {}
}
