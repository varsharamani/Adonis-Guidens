            Route.get('/:post_id/help-list', 'PostHelpersController.getHelperList');

  public async getHelperList({ response, params, auth }) {
        try {
            const helperData = await PostHelper.query()
                .where('post_id', params.post_id)
                .where('requestor_id', auth.user.id)
                .whereHas('helperUser', (query) => {
                    query.where('post_id', params.post_id);
                })
                .preload('helperUser', (userQuery) => {
                    userQuery.select('id', 'first_name', 'last_name', 'email', 'status', 'type');
                })
                .exec();

            return returnResponse(response, 'helper list get successfully..', 200, {
                data: helperData,
            });
        } catch (e) {
            return returnResponse(response, e.message, this.statusCode);
        }
    }