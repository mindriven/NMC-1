# Node Master Class assignment 2 - RESTfull API - Scenario

To start simply do `yarn start`.

I used flow type checker, vanilla JS is to be found in `out` folder. If formatting there seems off just do `yarn build:pretty` and check again.

System is divided into 2 parts: server and workers.

There are 3 workers, one for each task:
- sending an invoice
- deleting expired tokens
- archiving logs

Their intervals are to be set in configs.js.

Table Below documents available server endpoints. `X` in `token` column means that header named `token` must be sent and have value obtained by creating token (see table), otherwise request will be unauthorized (403);

| description                       | method | path      | token required | payload                                                      | qs parameters | on success                          |
| --------------------------------- | ------ | --------- | -------------- | ------------------------------------------------------------ | ------------- | ----------------------------------- |
| create user                       | POST   | /users    |                | user data, see example 1 below, all fields are required      | none          | 201, id of created user in response |
| get user data                     | GET    | /users    | X              | none                                                         | userId        | user object as payload              |
| update user data                  | PUT    | /users    | X              | same as when creating user                                   | none          | 200, empty response                 |
| delete user                       | DELETE | /users    | X              | none                                                         | none          | 200, empty response                 |
| create token (login)              | POST   | /tokens   |                | object with one property 'password', see example 2 below     | userId        | 200, token object in payload        |
| delete token (logout)             | DELETE | /tokens   |                | none                                                         | token         | 200, token gets dropped             |
| prolong token validity            | PUT    | /tokens   |                | none                                                         | token         | 200, token object in payload        |
| read token                        | GET    | /tokens   |                | none                                                         | token         | 200, token object in payload        |
| see menu                          | GET    | /menu     |                | none                                                         | none          | 200, menu in payload                |
| put items into cart               | POST   | /cart     | X              | single id or array of ids of menu items, see example 3 below | none          | 200, empty response                 |
| delete items from cart            | DELETE | /cart     | X              | same as above                                                | none          | 200, empty response                 |
| seeing cart content               | GET    | /cart     | X              | none                                                         | none          | 200, ids of items in the cart       |
| checkout - converts cart to order | POST   | /checkout | X              | card data, see example 4 below                               | none          | 201, order id in payload            |
| see an order                      | GET    | /orders   | X              | none                                                         | none          | 200, order object in payload        |


## Example payload 1 - User data
<code>{
    <br>&nbsp;&nbsp;"email": "test@gmail.com",
    <br>&nbsp;&nbsp;"firstName": "joe",
    <br>&nbsp;&nbsp;"lastName":"smith",
    <br>&nbsp;&nbsp;"password":"abc123",
    <br>&nbsp;&nbsp;"tosAgreement":true,
    <br>}
</code>

## Example payload 2 - generating token (login)
<code>{
    <br>&nbsp;&nbsp;"password":"abc123"
    <br>}
</code>

## Example payload 3 - Putting items into cart
<code>1</code> or <code>[1,2,3]</code>

<code>[1,1,1]</code> for putting menu position 1 three times

<code>[1,1,123]</code> for putting menu position 1 two times (unknown id will get ignored)

## Example payload 4 - Card data
<code>{
    <br>&nbsp;&nbsp;"number": "4242424242424242",
    <br>&nbsp;&nbsp;"exp_month": "12",
    <br>&nbsp;&nbsp;"exp_year": "2019",
    <br>&nbsp;&nbsp;"cvc": "123"
    <br>}
</code>

