@isTest
public with sharing class PermissionSetProcessorTest {
   
    @isTest static void testFieldPermissions(){
        String uniqueSystemAdminUserName = 'systemAdmin' + DateTime.now().getTime() + '@testorg.com';
        Profile p = [SELECT Id FROM Profile WHERE Name='System Administrator'];
        User systemAdminUser = new User(Alias = 'standt', Email='systemAdmin@testorg.com',
        EmailEncodingKey='UTF-8', LastName='Testing', LanguageLocaleKey='en_US',
        LocaleSidKey='en_US', ProfileId = p.Id,
        TimeZoneSidKey='America/Los_Angeles',
        UserName=uniqueSystemAdminUserName);
        test.startTest();
            system.runas(systemAdminUser){
                list<PermissionSetProcessor.option> options = new list<PermissionSetProcessor.option>();
                options = PermissionSetProcessor.getPermissionSetOptions();
                system.assert(options.size()>0, 'Atleast one profile or permission exist in the org');
                List<sObject> fieldPermissions = new List<sObject>();
                fieldPermissions = PermissionSetProcessor.getPermisssionMap(options[0].value, 'FIELD_PERMISSIONS');
                system.assert(fieldPermissions.size()>0, 'Atleast one field permission exist for system admin');
                //Contact.Account permission if exist
                List<sObject> permisssions = new List<sObject>();     
                permisssions = [select Id from FieldPermissions where ParentId = :options[0].value and Field = 'Contact.Account' limit 1];
                if(!permisssions.isEmpty()){
                    delete permisssions;
                }
                Map<string, string> data = new Map<string, string>();
                data.put('INSERT|FIELD_PERMISSIONS', '[{"Field": "Contact.Account", "SobjectType": "Contact", "PermissionsRead": true, "PermissionsEdit": false, "ParentId": "'+options[0].value+'"}]');
                Map<String,String> dmls = new Map<String,String>();
                dmls = PermissionSetProcessor.dmlPermissions(data);
                permisssions = [select Id from FieldPermissions where ParentId = :options[0].value and Field = 'Contact.Account' limit 1];
                system.assert(permisssions.size()>0, 'Contact.Account Field permission exist');
                data = new Map<string, string>();
                data.put('UPDATE|FIELD_PERMISSIONS', '[{"Field": "Contact.Account", "SobjectType": "Contact", "PermissionsRead": true, "PermissionsEdit": true, "ParentId": "'+options[0].value+'", "Id": "'+permisssions[0].id+'"}]');
                dmls = PermissionSetProcessor.dmlPermissions(data);             
                List<FieldPermissions> FieldPerm = new List<FieldPermissions>();
                FieldPerm = [select Id, PermissionsEdit from FieldPermissions where ParentId = :options[0].value and Field = 'Contact.Account' limit 1];
                system.assert(FieldPerm.size()>0, 'Updated Contact.Account Field PermissionsRead permission to false');                   
            }
        test.stopTest();        
    }

    @isTest static void testObjectPermissions(){
        String uniqueSystemAdminUserName = 'systemAdmin' + DateTime.now().getTime() + '@testorg.com';
        Profile p = [SELECT Id FROM Profile WHERE Name='System Administrator'];
        User systemAdminUser = new User(Alias = 'standt', Email='systemAdmin@testorg.com',
        EmailEncodingKey='UTF-8', LastName='Testing', LanguageLocaleKey='en_US',
        LocaleSidKey='en_US', ProfileId = p.Id,
        TimeZoneSidKey='America/Los_Angeles',
        UserName=uniqueSystemAdminUserName);
        test.startTest();
            system.runas(systemAdminUser){
                list<PermissionSetProcessor.option> options = new list<PermissionSetProcessor.option>();
                options = PermissionSetProcessor.getPermissionSetOptions();
                system.assert(options.size()>0, 'Atleast one profile or permission exist in the org');
                List<sObject> objectPermissions = new List<sObject>();
                objectPermissions = PermissionSetProcessor.getPermisssionMap(options[0].value, 'OBJECT_PERMISSIONS');
                system.assert(objectPermissions.size()>0, 'Atleast one object permission exist for system admin');
                Id systemAdminPermissionSetId = [select id, Label, ProfileId, Profile.Name from PermissionSet where Profile.Name = 'System Administrator' limit 1].Id;
                //Lead permission if exist
                List<sObject> permisssions = new List<sObject>();     
                permisssions = [select id from ObjectPermissions where ParentId = :systemAdminPermissionSetId and SobjectType = 'Lead' limit 1];
                Map<string, string> data = new Map<string, string>();
                data.put('INSERT|OBJECT_PERMISSIONS', '[{"SobjectType": "Lead", "PermissionsCreate": false, "PermissionsRead": true, "PermissionsEdit": false, "PermissionsDelete": false, "PermissionsViewAllRecords": false, "PermissionsModifyAllRecords": false, "ParentId": "'+options[0].value+'"}]');
                Map<String,String> dmls = new Map<String,String>();
                dmls = PermissionSetProcessor.dmlPermissions(data);
                permisssions = [select id from ObjectPermissions where ParentId = :options[0].value and SobjectType = 'Lead' limit 1];
                system.assert(permisssions.size()>0, 'Lead object permission exist');
                data = new Map<string, string>();
                data.put('UPDATE|OBJECT_PERMISSIONS', '[{"SobjectType": "Lead", "PermissionsCreate": true, "PermissionsRead": true, "PermissionsEdit": false, "PermissionsDelete": false, "PermissionsViewAllRecords": false, "PermissionsModifyAllRecords": false, "ParentId": "'+options[0].value+'", "Id": "'+permisssions[0].id+'"}]');
                dmls = PermissionSetProcessor.dmlPermissions(data);     
                List<ObjectPermissions> objPermisssions = new List<ObjectPermissions>();     
                objPermisssions = [select id, PermissionsCreate from ObjectPermissions where ParentId = :options[0].value and SobjectType = 'Lead' limit 1];
                system.assert(objPermisssions[0].PermissionsCreate == true, 'Updated permissionsCreate permission exist');                
            }
        test.stopTest();        
    }

}