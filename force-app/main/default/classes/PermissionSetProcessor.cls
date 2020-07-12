public with sharing class PermissionSetProcessor{

    private static final string FIELD_PERMISSIONS = 'FIELD_PERMISSIONS';
    private static final string OBJECT_PERMISSIONS = 'OBJECT_PERMISSIONS';

    private static final string DML_TYPE_INSERT = 'INSERT';
    private static final string DML_TYPE_UPDATE = 'UPDATE';    
    
    //permission set combobox options
    public class option{
        @AuraEnabled
        public string label {get; set;}
        @AuraEnabled
        public string value {get; set;}
    }

    @AuraEnabled(cacheable = true)
	public static list<option> getPermissionSetOptions(){
        list<option> options = new list<option>();
        List<PermissionSet> permissionSetList = new List<PermissionSet>();
        permissionSetList = [select id, Label, ProfileId, Profile.Name from PermissionSet];
        for(PermissionSet ps: permissionSetList){
            option item = new option();
            if(string.isNotBlank(ps.Profile.Name)){
                item.label = ps.Profile.Name;
            }else{
                item.label = ps.label;
            }            
            item.value = ps.id;
            options.add(item);
        }
        return options;
    }

    @AuraEnabled(cacheable = false)
	public static List<sObject> getPermisssionMap(Id permissionSetId, string permissionType){
        List<sObject> permisssions = new List<sObject>();     
        if(permissionType.toUppercase() == FIELD_PERMISSIONS){
            permisssions = [select Field, PermissionsRead, PermissionsEdit, Id, ParentId, SobjectType from FieldPermissions where ParentId = :permissionSetId];
        }else if(permissionType.toUppercase() == OBJECT_PERMISSIONS){
            permisssions = [select id, ParentId, PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords, SobjectType from ObjectPermissions where ParentId = :permissionSetId];
        }
        return permisssions;
    }

    @AuraEnabled(cacheable = false)
	public static Map< String, String> dmlPermissions(Map<string, string> data){
        Savepoint sp = Database.setSavepoint();
        map<String, String> result = new map<String, String>();      
        try{
            
            for(string key : data.keyset()){

                list<string> dataKeySplit = key.split('\\|');
                string dmlType = dataKeySplit[0];
                string permissionType = dataKeySplit[1];
            
                if(permissionType==FIELD_PERMISSIONS){
                    List<FieldPermissions> fldPermissions = (List<FieldPermissions>)System.JSON.deserializeStrict(data.get(key), List<FieldPermissions>.Class);
                    if(dmlType==DML_TYPE_INSERT){
                        //insert fldPermissions;
                        Database.SaveResult[] saveResults = Database.insert(fldPermissions, false);
                        String processedResults = processSaveResults(saveResults);
                        result.put(key + ' was successful.', processedResults);
                    }
                    if(dmlType==DML_TYPE_UPDATE){
                        //update fldPermissions;
                        Database.SaveResult[] saveResults = Database.update(fldPermissions, false);
                        String processedResults = processSaveResults(saveResults);
                        result.put(key + ' was successful.', processedResults);
                    }
                }
                else if(permissionType==OBJECT_PERMISSIONS){
                    List<ObjectPermissions> objPermissions = (List<ObjectPermissions>)System.JSON.deserializeStrict(data.get(key), List<ObjectPermissions>.Class);
                    if(dmlType==DML_TYPE_INSERT){
                        //insert objPermissions;
                        Database.SaveResult[] saveResults = Database.insert(objPermissions, false);
                        String processedResults = processSaveResults(saveResults);
                        result.put(key + ' was successful.', processedResults);
                    }
                    if(dmlType==DML_TYPE_UPDATE){
                        //update objPermissions;
                        Database.SaveResult[] saveResults = Database.update(objPermissions, false);
                        String processedResults = processSaveResults(saveResults);
                        result.put(key + ' was successful.', processedResults);
                    }
                }

            }
        }catch(exception ex){
            Database.rollback(sp);
            result.put(ex.getMessage(), ex.getStackTraceString());
        }
        return result;
    }

    public static string processSaveResults(Database.SaveResult[] result){
        String resultString = '';
        Integer successCounter = 0;
        Integer errorCounter = 0;
        String errorHtml = '';
        for (Database.SaveResult sr : result) {
            if (sr.isSuccess()) {
                successCounter += 1;
            }
            else {
                errorCounter += 1;
                // Operation failed, so get all errors   
                String errorInnerHtml = '<br/>';             
                for(Database.Error err : sr.getErrors()) {
                    errorInnerHtml = errorInnerHtml + ' ' + err.getStatusCode() + ': ' + err.getMessage() + ' due to ' + err.getFields();
                    errorHTML = errorHTML + errorInnerHtml;
                }
            }
        }
        errorHtml = errorHtml + '<br/>';
        resultString = string.valueof(successCounter) + ' successful inserts. <br/>';
        resultString = resultString + string.valueof(errorCounter) + ' insert errors. <br/>';
        resultString = resultString + errorHtml;
        return resultString;
    }
    
}