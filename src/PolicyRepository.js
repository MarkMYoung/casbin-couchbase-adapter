const Couchbase = require( 'couchbase' );
const CasbinPolicyModel = require( './CasbinPolicyModel' );
//=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=//
class PolicyRepository
{
	constructor( options )
	{
		if( !(typeof( options.bucketURI ) === 'string' && !!options.bucketURI))
		{throw new Error( "The connection URI must be specified." );}
		else if(!(typeof( options.bucketName ) === 'string' && !!options.bucketName))
		{throw( new TypeError( "'bucketName' must be a string." ));}
		else if(!(typeof( options.clusterPassword ) === 'string' && !!options.clusterPassword))
		{throw( new TypeError( "'clusterPassword' must be a string." ));}
		else if(!(typeof( options.clusterUsername ) === 'string' && !!options.clusterUsername))
		{throw( new TypeError( "'clusterUsername' must be a string." ));}
		else if(!(typeof( options.keyDelimiter ) === 'string' && !!options.keyDelimiter))
		{throw( new TypeError( "'keyDelimiter' must be a string, perhaps '::'." ));}
		else if(!(typeof( options.keyPrefix ) === 'string' && !!options.keyPrefix))
		{throw( new TypeError( "'keyPrefix' must be a string, perhaps 'Permission'." ));}

		this.bucketName = options.bucketName;
		this.bucketURI = options.bucketURI;
		// this.clusterUsername = options.clusterUsername;
		// this.clusterPassword = options.clusterPassword;
		this.keyDelimiter = options.keyDelimiter;
		this.keyPrefix = options.keyPrefix;

		this.cluster = new Couchbase.Cluster( options.bucketURI );
		this.cluster.authenticate( options.clusterUsername, options.clusterPassword );
		this.bucket = this.cluster.openBucket( options.bucketName );
	}

	async connected()
	{return( new Promise( resolve => this.bucket.once( 'connect', resolve )));}


	/**
	 * 
	 * @param {CasbinPolicyModel} casbinPolicy 
	 */
	calculateKey( casbinPolicy )
	{
		const parts =
		[
			this.keyPrefix, casbinPolicy.pType, 
			casbinPolicy.v0, casbinPolicy.v1, casbinPolicy.v2, 
			casbinPolicy.v3, casbinPolicy.v4, casbinPolicy.v5
		];
		const key = parts.join( this.keyDelimiter );
		return( key );
	}

	async getListWhere( namedParameters )
	{
		return( new Promise( function( resolve, reject )
		{
			try{
				let statement = `SELECT * FROM \`${this.bucketName}\` AS docAlias WHERE`;
				let predicates = Object.keys( namedParameters )
					.map( function( param, p, params )
					{return( `\`${param}\`=$\`${param}\`` );});
				statement = `${statement} ${predicates.join( ' AND ' )};`;

				this.bucket.query(
					Couchbase.N1qlQuery.fromString( statement ),
					namedParameters,
					function couchbaseCallback( error, result )
					{
						if( !error )
						{
							const rows = result.map( each => each.docAlias );
							resolve( rows );
						}
						else
						{reject( error );}
					}
				)
			}
			catch( exc )
			{reject( exc );}
		}));
	}

	/**
	 * 
	 * @param {CasbinPolicyModel} casbinPolicy 
	 */
	async removeItem( casbinPolicy )
	{
		return( new Promise( function( resolve, reject )
		{
			try{
				const storageKey = this.persistenceCalculateKey( casbinPolicy );
				this.bucket.remove(
					storageKey,
					function couchbaseCallback( error, result )
					{
						if( !error )
						{resolve();}
						else
						{reject( error );}
					}
				);
			}
			catch( exc )
			{reject( exc );}
		}));
	}

	async removeListWhere( namedParameters )
	{
		return( new Promise( function( resolve, reject )
		{
			try{
				let statement = `DELETE FROM \`${this.bucketName}\` WHERE`;
				let predicates = Object.keys( namedParameters )
					.map( function( param, p, params )
					{return( `\`${param}\`=$\`${param}\`` );});
				statement = `${statement} ${predicates.join( ' AND ' )};`;

				this.bucket.query(
					Couchbase.N1qlQuery.fromString( statement ),
					namedParameters,
					function couchbaseCallback( error, result )
					{
						if( !error )
						{resolve();}
						else
						{reject( error );}
					}
				)
			}
			catch( exc )
			{reject( exc );}
		}));
	}

	/**
	 * 
	 * @param {CasbinPolicyModel} casbinPolicy 
	 */
	async upsertItem( casbinPolicy )
	{
		return( new Promise( function( resolve, reject )
		{
			try{
				const storageKey = this.persistenceCalculateKey( casbinPolicy );
				this.bucket.upsert( storageKey, casbinPolicy,
					function couchbaseCallback( error, result )
					{
						if( !error )
						{resolve( result );}
						else
						{reject( error );}
					}
				);
			}
			catch( exc )
			{reject( exc );}
		}));
	}
}
//=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=//
module.exports = PolicyRepository;