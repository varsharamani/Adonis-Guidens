import Route from '@ioc:Adonis/Core/Route';
import 'App/Routes/admin';

Route.post('/auth/login', 'AuthController.login');
Route.post('/auth/register', 'AuthController.register');
Route.get('/auth/email/verify/:email/:id', 'AuthController.verifyEmail').as('verifyEmail');

Route.group(() => {
    Route.post('/', 'ForgetPasswordsController.forget');
    Route.post('/mobile', 'ForgetPasswordsController.forgetMobile');
    Route.post('/send-otp', 'ForgetPasswordsController.sendOtp');
    Route.post('/verify-otp', 'ForgetPasswordsController.verifyOtp');
    Route.post('/reset-password', 'ForgetPasswordsController.resetPassword');
}).prefix('/forget');

Route.post('/auth/password/forgot', 'ForgetPasswordsController.forgotPassword');
Route.post(
    '/auth/password/reset/:id/:token',
    'ForgetPasswordsController.resetPasswordWithEmail'
).as('resetPassword');

Route.group(() => {
    // registration flow
    Route.post('mobile/send-otp', 'AuthController.sendMobileOtp');
    Route.post('mobile/verify-otp', 'AuthController.verifyMobileOtp');
    Route.post('set-dob', 'AuthController.setDateOfBirth');
    Route.post('upload-profile-picture', 'AuthController.uploadProfilePicture');
    Route.post('id-verification', 'AuthController.idVerification');
    Route.post('verification-link', 'VerificationsController.create');
    // authentication flow
    Route.get('/auth/user', 'AuthController.user');
    Route.post('/auth/user', 'AuthController.update');
    Route.post('/set-lat-lng', 'AuthController.setLatLng');

    Route.post('/auth/logout', 'AuthController.logout');
    Route.post('/auth/email/verify/resend', 'AuthController.resendVerificationEmail');

    Route.group(() => {
        // assign category
        Route.get('/categories', 'CategoriesController.index');
        Route.post('/categories/user-assign', 'CategoriesController.userAssign');

        // create post
        Route.group(() => {
            Route.get('/history', 'PostsController.history');
            Route.post('/:post_id/update-status', 'PostsController.statusUpdate');
            Route.post('/:post_id/request-fulfill', 'PostsController.requestFulfill');
            Route.post('/:post_id/helper-feedback', 'PostsController.helperFeedback');
            Route.post('/:post_id/help', 'PostHelpersController.assignHelperToPost');
            Route.post(
                '/:post_id/help-status/:post_helper_id',
                'PostHelpersController.statusUpdate'
            );
            Route.get('/:post_id/help-list', 'PostHelpersController.getHelperList');

            // post reports
            Route.post('/:id/report', 'PostReportsController.store');
            Route.post('/:id/report-claim', 'PostReportsController.update');
        }).prefix('/posts');
        Route.resource('/posts', 'PostsController').apiOnly();

        Route.get('/post-helpers', 'PostHelpersController.getPostHelperList');

        // users
        Route.group(() => {
            Route.get('my-block-users', 'UsersController.myBlockList');
            Route.get(':id', 'UsersController.show');
            Route.post(':id/report', 'UsersController.report');
            Route.post(':id/block', 'UsersController.block');
            Route.post(':id/unblock', 'UsersController.unblock');
        }).prefix('/users');
    }).middleware('accountVerified');

    //assign helper to post
}).middleware('auth:api');

Route.post('persona-webhook', 'VerificationsController.webhook');
