# casbin-couchbase-adapter

Couchbase adapter for Casbin https://github.com/casbin/node-casbin

Couchbase Adapter is the [Couchbase](https://github.com/MarkMYoung/casbin-couchbase-adapter) adapter for [Casbin](https://github.com/casbin/node-casbin). With this library, Casbin can load policy from Couchbase supported database or save policy to it.

Based on [casbin-couchbase-adapter](https://github.com/szy0syz/casbin-mongoose-adapter).

## Installation

		npm install casbin-couchbase-adapter

## Simple Example

```js
const Casbin = require( 'casbin' );
const CasbinCouchbaseAdapter = require( 'casbin-couchbase-adapter' );

~(async function()
{
	// Initialize a Couchbase adapter and use it in a Node-Casbin enforcer:
	// The adapter will use the CouchbaseDB database named "test".
	// If it doesn't exist, the adapter will create it automatically.
	try{
		const casbinModel = new Casbin.Model();
		casbinModel.loadModel( `${__dirname}/config/model.conf` );
		const casbinAdapter = new CasbinCouchbaseAdapter( '<uri>',
		{
			bucketURI:'<uri>',
			bucketName:'bucket',
			clusterPassword:'password',
			clusterUsername:'username',
			keyDelimiter:'<delimiter>',// e.g., '::'
			keyPrefix:'<prefix>',// e.g., 'Permission'
		});
		const enforcer = await Casbin.newEnforcer( casbinModel, casbinAdapter );

		// Load policies from the database.
		await enforcer.loadPolicy();

		// Add a policy.
		await enforcer.addPolicy( null, 'p', ['alice', 'data1', 'read']);

		// Check permissions.
		let isMatched = enforcer.enforce( 'alice', 'data1', 'read' );
		console.log( isMatched );

		await enforcer.removePolicy( null, 'p', ['alice', 'data1', 'read']);

		// Save policies back to the database.
		await enforcer.savePolicy();

		process.exit();
	}
	catch( exc )
	{console.error( exc );}
})();
```

## More Elaborate Example

```js
// Simple interface for a RBAC (Role-Based Access Control) data model 
//	with domain/tenant and deny-override.
class RBACDRequestAuthorizer
{
	constructor({enforcer})
	{this.enforcer = enforcer;}

	/**
	 * @returns Promise<void>
	 */
	async assertPermission({subject, domain, object, action})
	{
		const self = this;
		return( new Promise(( resolve, reject ) =>
		{
			const isAuthorized = self.checkPermission({subject, domain, object, action});
			if( isAuthorized )
			// Do not resolve a value so `.then( next )` can be used directly.
			{resolve();}
			else
			{reject( 'deny' );}
		}));
	}

	/**
	 * @returns Promise<void>
	 */
	async assertPermissions( requestDefinitions )
	{
		const self = this;
		return( new Promise(( resolve, reject ) =>
		{
			const isAuthorized = requestDefinitions
				.some(({subject, domain, object, action}) => 
					self.checkPermission({subject, domain, object, action})
				);
			if( isAuthorized )
			// Do not resolve a value so `.then( next )` can be used directly.
			{resolve();}
			else
			{reject( 'deny' );}
		}));
	}

	/**
	 * @returns boolean
	 */
	checkPermission({subject, domain, object, action})
	{
		const isAuthorized = this.enforcer.enforce( subject, domain, object, action );
		return( isAuthorized );
	}
}
```

```js
// Express or Restify global decorator to expose `authorizer`.
function casbinAuthorizer( enforcerFactory )
{
	return( async( req, res, next ) =>
	{
		const enforcer = await enforcerFactory();
		if( !(enforcer instanceof Enforcer))
		{
			const errorString = "Invalid enforcer";
			res.status( 500 ).json({500:errorString});
			next( errorString );
		}
		else
		{
			const authorizer = new RBACDRequestAuthorizer({enforcer});
			res.authorizer = authorizer;
			next();
		}
	});
};
```

```js
// Express or Restify initialization.
server.use( casbinAuthorizer( async() =>
{
	// const enforcer = await Casbin.newEnforcer( `${__dirname}/permission/config/model.conf`, `${__dirname}/permission/config/policy.csv` );
	//X const casbinModel = Casbin.newModel( './permission/config/model.conf' );
	const casbinModel = new Casbin.Model();
	casbinModel.loadModel( `${__dirname}/permission/config/model.conf` );
	const casbinAdapter = new CasbinCouchbaseAdapter( '<uri>',
	{
		bucketURI:'<uri>',
		bucketName:'bucket',
		clusterPassword:'password',
		clusterUsername:'username',
		keyDelimiter:'<delimiter>',// e.g., '::'
		keyPrefix:'<prefix>',// e.g., 'Permission'
	});
	const enforcer = await Casbin.newEnforcer( casbinModel, casbinAdapter );
	return( enforcer );
}));
```

```js
// Express or Restify route decorator.
expressOrRestifyServer.get( '/noun/:paramName',
[
	async function routeAuthorizer( req, res, next )
	{
		res.authorizer.assertPermission(
		{
			subject:`Subject~${res.user.id}`,
			domain:`Tenant~${req.params.paramName}`,
			object:'noun',
			action:req.method,
		})
		.then( next )
		.catch( function( exc )
		{
			const messageObj = {message: "Forbidden", severity: 'Error', name: 'AccessDeniedError'};
			res.json( 403, {'messages':[ messageObj ],});
		});
	},
	// ...
]);
```

## Getting Help

- [Casbin](https://github.com/casbin/node-casbin)

## License

This project is under GNU General Public License v3.0. See the [LICENSE](LICENSE) file for the full license text.
