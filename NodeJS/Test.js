var group_member_names = ["","Sarkis Khorozian","Baber Jan","",""]; 


console.log ("This is a test.");

for (var i = 0; i < group_member_names.length; i++) {
	if (i == 0)
		console.log ("The students working on this group are:");
	console.log ((i+1) + ") " + group_member_names[i]);
}
