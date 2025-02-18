# api-letterex
API for a social network to exchange letters and learn languages

# Available paths
Needs authentication marked with 🔑
Needed body inputs between (), mandatory ones with marked with *

## For user related services
POST http://localhost:3090/api/user/register (nickname* email* password* masterLanguage* learningLanguage* masterLanguage2 learningLanguage2 learningLanguage3)
POST http://localhost:3090/api/user/login  (email* password*)
GET http://localhost:3090/api/user/profile/:id 🔑  
GET http://localhost:3090/api/user/list-users/:page? 🔑 (page)
PUT http://localhost:3090/api/user/update 🔑  (masterLanguage masterLanguage2 learningLanguage learningLanguage2 learningLanguage3 image)
PUT http://localhost:3090/api/user/change-password 🔑  (currentPassword* newPassword*)
POST http://localhost:3090/api/user/profile-picture 🔑 (file)  
GET http://localhost:3090/api/user/profile-picture/:id   


## For document (letters) related services
POST http://localhost:3090/api/letter/new 🔑 (title* content* language* created_at* diary)
GET http://localhost:3090/api/letter/view/:letterId 🔑  
PUT http://localhost:3090/api/letter/edit/:id 🔑  (title, content, diary, language, sharedWith)
DELETE http://localhost:3090/api/letter/delete/:id 🔑  
GET http://localhost:3090/api/letter/list 🔑  
POST http://localhost:3090/api/letter/share/:id 🔑  (sharedWith)


## For follow/friends related services
POST http://localhost:3090/api/follow/add/:id 🔑  
DELETE http://localhost:3090/api/follow/unfollow/:id 🔑  
GET http://localhost:3090/api/follow/friend-request/:id 🔑  
GET http://localhost:3090/api/follow/friends 🔑  
POST http://localhost:3090/api/follow/request-follow/:id 🔑  
GET http://localhost:3090/api/follow/friend-requests 🔑  
POST http://localhost:3090/api/follow/friend-request/accept/:id 🔑  
POST http://localhost:3090/api/follow/friend-request/reject/:id 🔑  

## For correting letters services
PATCH http://localhost:3090/api/corrected/send-back/:correctedLetterId 🔑  
GET http://localhost:3090/api/corrected/corrections/:originalLetterId 🔑  




