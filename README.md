# Description
Connect your thirpAPI account with slack, offering a way to get useful data and display it in the commodity of your slack environment. 

Set reminders or ask directly for the data with just a command, your thirpAPI assistant will be there to help you.

thirpAPI lets you use two slash commands: /thirpAPIstats that show data related to your thirpAPI account and /thirpAPIsetreport that let you program a daily report of this data on the channel where the command was issued.

# How to use the slash commands:
| /thirpAPIstats options| Description 
| ------ | ------ 
| /thirpAPIstats | Show Macro usage and tickets data from your thirpAPI account. |
| /thirpAPIstats usage | Show Macro usage from your thirpAPI account.
| /thirpAPIstats tickets | Show tickets data from your thirpAPI account.

| /thirpAPIsetreport| Description 
| ------ | ------ 
|/thirpAPIsetreport HH:MM  (where HH:MM is the time expressed on a 24 hour format, HH been hours and MM been minutes) | Show a daily report of  macro usage and ticket data on the channel where the command was issued on the specified hour.