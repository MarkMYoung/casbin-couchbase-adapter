const {Helper, Model} = require( 'casbin' );
const CasbinPolicyModel = require( './CasbinPolicyModel' );
const PermissionRepository = require( './PermissionRepository' );
//=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=//
/**
 * Implements a policy adapter for Casbin with Couchbase support.
 *
 * @class
 */
class CasbinCouchbaseAdapter
{
	/**
	 * Creates a new instance of Couchbase adapter for Casbin.
	 * It does not wait for successfull connection to Couchbase.
	 * So, if you want to have a possibility to wait until connection successful, use newAdapter instead.
	 *
	 * @constructor
	 * @param {string} uri Couchbase URI where Casbin rules must be persisted
	 * @param {Object} [options={}] Additional options to pass on to Couchbase client
	 * @example
	 * const adapter = new CasbinCouchbaseAdapter( 'COUCHBASE_URI',
	 * {
	 *		bucketName:'name',
	 *		clusterUsername:'username',
	 *		clusterPassword:'password'
	 * });
	 */
	constructor( uri, options = {})
	{
		if( !(typeof( uri ) === 'string' && !!uri))
		{throw new Error( "The connection URI must be specified." );}

		// By default, adapter is not filtered.
		this.isFiltered = options.isFiltered || false;
		options.bucketURI = uri;
		
		this.policyRepository = new PermissionRepository( options );
	}

	/**
	 * Creates a new instance of Couchbase adapter for Casbin.
	 * Instead of constructor, it does wait for successfull connection to Couchbase.
	 * Preferable way to construct an adapter instance, is to use this static method.
	 *
	 * @static
	 * @param {string} uri Couchbase URI where Casbin rules must be persisted
	 * @param {Object} [options={}] Additional options to pass on to Couchbase client
	 * @example
	 * const adapter = await CasbinCouchbaseAdapter.newAdapter( 'COUCHBASE_URI',
	 * {
	 *		bucketName:'name',
	 *		clusterUsername:'username',
	 *		clusterPassword:'password'
	 * });
	 */
	static async newAdapter( uri, options = {})
	{
		const casbinAdapter = new CasbinCouchbaseAdapter( uri, options );
		await casbinAdapter.policyRepository.connected();
		return casbinAdapter;
	}

	/**
	 * Implements the process of adding policy rule.
	 * This method is used by Casbin and should not be called by user.
	 *
	 * @param {string} sec Section of the policy
	 * @param {string} pType Type of the policy (e.g. "p" or "g")
	 * @param {Array<string>} rule Policy rule to add into enforcer
	 * @returns {Promise<void>}
	 */
	async addPolicy( sec, pType, rule )
	{
		const casbinPolicy = this.savePolicyLine( pType, rule );
		await this.policyRepository.upsertItem( casbinPolicy );
	}

	/**
	 * Switch adapter to (non)filtered state.
	 * Casbin uses this flag to determine if it should load the whole policy from DB or not.
	 *
	 * @param {boolean} [is_filtered=true] Flag that represents the current state of adapter (filtered or not)
	 */
	setFiltered( is_filtered = true )
	{this.isFiltered = is_filtered;}

	/**
	 * Implements the process of loading policy from database into enforcer.
	 * This method is used by Casbin and should not be called by user.
	 *
	 * @param {Model} model Model instance from enforcer
	 * @returns {Promise<void>}
	 */
	async loadPolicy( model )
	{
		const namedParameters = {...model};
		await this.policyRepository.getListWhere( namedParameters );
	}

	/**
	 * Loads one policy rule into Casbin model.
	 * This method is used by Casbin and should not be called by user.
	 *
	 * @param {CasbinPolicyModel} casbinPolicy Record with one policy rule from Couchbase
	 * @param {Model} model Casbin model to which policy rule must be loaded
	 */
	loadPolicyLine( casbinPolicy, model )
	{
		let policy_line = casbinPolicy.pType;

		if( casbinPolicy.v0 )
		{policy_line += ', ' + casbinPolicy.v0;}

		if( casbinPolicy.v1 )
		{policy_line += ', ' + casbinPolicy.v1;}

		if( casbinPolicy.v2 )
		{policy_line += ', ' + casbinPolicy.v2;}

		if( casbinPolicy.v3 )
		{policy_line += ', ' + casbinPolicy.v3;}

		if( casbinPolicy.v4 )
		{policy_line += ', ' + casbinPolicy.v4;}

		if( casbinPolicy.v5 )
		{policy_line += ', ' + casbinPolicy.v5;}

		Helper.loadPolicyLine( policy_line, model );
	}

	// /**
	//  * Loads partial policy based on filter criteria.
	//  * This method is used by Casbin and should not be called by user.
	//  *
	//  * @param {Model} model Enforcer model
	//  * @param {Object} [filter] Couchbase filter to query
	//  */
	// async loadFilteredPolicy( model, filter )
	// {
	// 	if( filter )
	// 	{this.setFiltered( true );}
	// 	else
	// 	{this.setFiltered( false );}

	// 	const lines = await this.persistenceFindWhere( filter || {});
	// 	for( const line of lines )
	// 	{this.loadPolicyLine( line, model );}
	// }

	/**
	 * Implements the process of removing policy rule.
	 * This method is used by Casbin and should not be called by user.
	 *
	 * @param {string} sec Section of the policy
	 * @param {string} p_type Type of the policy (e.g. "p" or "g")
	 * @param {Array<string>} rule Policy rule to remove from enforcer
	 * @returns {Promise<void>}
	 */
	async removePolicy( sec, p_type, rule )
	{
		const {pType, v0, v1, v2, v3, v4, v5} = this.savePolicyLine( p_type, rule );
		const casbinPolicy = new CasbinPolicyModel({pType, v0, v1, v2, v3, v4, v5});
		await this.policyRepository.removeItem( casbinPolicy );
	}

	/**
	 * Implements the process of removing policy rules.
	 * This method is used by Casbin and should not be called by user.
	 *
	 * @param {string} sec Section of the policy
	 * @param {string} pType Type of the policy (e.g. "p" or "g")
	 * @param {number} fieldIndex Index of the field to start filtering from
	 * @param	{...string} fieldValues Policy rule to match when removing (starting from fieldIndex)
	 * @returns {Promise<void>}
	 */
	async removeFilteredPolicy( sec, pType, fieldIndex, ...fieldValues )
	{
		let namedParameters = {pType};

		//@TODO this logic needs to be simplified
		if( fieldIndex <= 0 && fieldIndex + fieldValues.length > 0 && !!fieldValues[0 - fieldIndex])
		{namedParameters.v0 = fieldValues[0 - fieldIndex];}

		if( fieldIndex <= 1 && fieldIndex + fieldValues.length > 1 && !!fieldValues[1 - fieldIndex])
		{namedParameters.v1 = fieldValues[1 - fieldIndex];}

		if( fieldIndex <= 2 && fieldIndex + fieldValues.length > 2 && !!fieldValues[2 - fieldIndex])
		{namedParameters.v2 = fieldValues[2 - fieldIndex];}

		if( fieldIndex <= 3 && fieldIndex + fieldValues.length > 3 && !!fieldValues[3 - fieldIndex])
		{namedParameters.v3 = fieldValues[3 - fieldIndex];}

		if( fieldIndex <= 4 && fieldIndex + fieldValues.length > 4 && !!fieldValues[4 - fieldIndex])
		{namedParameters.v4 = fieldValues[4 - fieldIndex];}

		if( fieldIndex <= 5 && fieldIndex + fieldValues.length > 5 && !!fieldValues[5 - fieldIndex])
		{namedParameters.v5 = fieldValues[5 - fieldIndex];}

		await this.policyRepository.removeListWhere( namedParameters );
	}

	/**
	 * Implements the process of saving policy from enforcer into database.
	 * This method is used by Casbin and should not be called by user.
	 *
	 * @param {Model} model Model instance from enforcer
	 * @returns {Promise<boolean>}
	 */
	async savePolicy( model )
	{
		const policyRuleAST = model.model.get( 'p' );
		const groupingPolicyAST = model.model.get( 'g' );

		for( const [pType, ast] of policyRuleAST )
		{
			for( const rule of ast.policy )
			{
				const casbinPolicy = this.savePolicyLine( pType, rule );
				await this.policyRepository.upsertItem( casbinPolicy );
			}
		}

		for( const [pType, ast] of groupingPolicyAST )
		{
			for( const rule of ast.policy )
			{
				const casbinPolicy = this.savePolicyLine( pType, rule );
				await this.policyRepository.upsertItem( casbinPolicy );
			}
		}

		return true;
	}

	/**
	 * Persists one policy rule into Couchbase.
	 * This method is used by Casbin and should not be called by user.
	 *
	 * @param {string} pType Policy type to save into Couchbase
	 * @param {Array<string>} rule An array which consists of policy rule elements to store
	 * @returns {CasbinPolicyModel} Returns a created CasbinPolicyModel record for Couchbase
	 */
	savePolicyLine( pType, rule )
	{
		const [v0, v1, v2, v3, v4, v5] = rule;
		const casbinPolicy = new CasbinPolicyModel({pType, v0, v1, v2, v3, v4, v5});
		return( casbinPolicy );
	}
}
//=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=//
module.exports = CasbinCouchbaseAdapter;