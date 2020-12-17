const functions = require('firebase-functions');
// The Firebase Admin SDK to access Cloud Firestore.
const admin = require('firebase-admin');
admin.initializeApp();
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
const db = admin.firestore();


exports.detectNewMessage = functions.firestore
    .document('chats/{chatId}/messages/{messageId}')
    .onCreate((change, context) => {
        let message = change.data();
        functions.logger.log(change.data())
        // Notification details.
        let payload = {
            data: {
                type: 0
            },
            notification: {
                android_channel_id: 'App Notifications',
                body: `${message['message']}`,
            }
        };
        /**
         * Get sender user info
         */

        return db.collection(`users`)
            .doc(`${message['userId']}`)
            .get()
            .then(user => {
                payload.notification.title = user.data()['firstName'];
                /**
                 * Get recipient user info
                 */
                return db.collection(`users`)
                    .doc(`${message['recipientId']}`)
                    .get()
                    .then(user => {
                        let userToken = user.data()['deviceId'];
                        return admin.messaging().sendToDevice(userToken, payload);
                    })
            })
    });

exports.detectNewFollowers = functions.firestore
    .document('followers/{follower_id}')
    .onUpdate((change, context) => {
        let payload = {
            notification: {
                title: 'New user',
                android_channel_id: 'App Notifications'
            }
        };
        let prevCollection = change.before.data();
        let afterCollection = change.after.data();
        let newSubscriber = afterCollection['followers'].find(item => {
            return !prevCollection['followers'].some(_prevItem => {
                return _prevItem.userId === item.userId;
            })
        })
        functions.logger.info("Prev", prevCollection)
        functions.logger.info("After", afterCollection)
        functions.logger.info("Diff", newSubscriber)
        if (newSubscriber) {
            return db.collection(`users`).where('followersId', '==', context.params['follower_id'])
                .get()
                .then(users => {
                    /**
                     * Get user that we followed
                     * @type {FirebaseFirestore.DocumentData}
                     */
                    let user = users.docs[0].data();
                    /**
                     * Check his followers
                     */
                    db.collection(`followingUsers`)
                        .doc(`${user['followingId']}`)
                        .get()
                        .then(_userFollowers => {
                            let userFollowers = _userFollowers.data();
                            functions.logger.info("userFollowers", userFollowers)
                            functions.logger.info("ContextParams", context.params)
                            let userToken = user['deviceId'];
                            /**
                             * Check if it is followed our user
                             */
                            let isMatched = userFollowers['followingUsers'].some(follower => {
                                return follower.userId === newSubscriber.userId;
                            })
                            if (isMatched) {
                                payload.data['type'] = 2;
                                payload.notification.body = `${newSubscriber['name']} matched you`
                                if (user['matchPush']) {
                                    return admin.messaging().sendToDevice(userToken, payload);
                                }
                            } else {
                                payload.data['type'] = 1;
                                payload.notification.body = `${newSubscriber['name']} followed you`
                                if (user['followingPush']) {
                                    return admin.messaging().sendToDevice(userToken, payload);
                                }
                            }

                        })

                })

        } else {
            return "Unfollow action"
        }


    })
