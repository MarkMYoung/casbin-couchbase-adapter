class CasbinPolicyModel
{
	constructor({pType = '', v0 = '', v1 = '', v2 = '', v3 = '', v4 = '', v5 = ''} = {})
	{
		this.pType = pType;
		this.v0 = v0;
		this.v1 = v1;
		this.v2 = v2;
		this.v3 = v3;
		this.v4 = v4;
		this.v5 = v5;
		// Does not work with "javascript.implicitProjectConfig.checkJs".
		// Object.assign( this, {pType, v0, v1, v2, v3, v4, v5});
	}

	//? toJSON(){}
}
module.exports = CasbinPolicyModel;